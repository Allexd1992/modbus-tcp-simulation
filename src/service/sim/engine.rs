use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use rquickjs::prelude::{Func, Rest};
use rquickjs::{Array, CatchResultExt, Context, Function, Runtime, Value};

use crate::service::modbus::hooks::{WriteEvent, WriteValues};
use crate::service::modbus::interfaces::IRegistry;
use crate::service::modbus::store::Store;

const MODBUS_TYPED_API: &str = include_str!("modbus_api.js");
const MAP_TYPED_API: &str = include_str!("map_api.js");

enum ScriptMsg {
    Write(WriteEvent),
    Timer { id: u64, generation: u64 },
    Reload,
    ReloadVarMap,
}

struct TimerRegistration {
    interval_ms: u64,
}

#[derive(Clone)]
pub struct ScriptEngineHandle {
    script_tx: std::sync::mpsc::Sender<ScriptMsg>,
    _thread: Arc<JoinHandle<()>>,
}

impl ScriptEngineHandle {
    pub fn reload(&self) -> anyhow::Result<()> {
        self.script_tx
            .send(ScriptMsg::Reload)
            .map_err(|e| anyhow::anyhow!("script engine unavailable: {e}"))
    }

    pub fn reload_var_map(&self) -> anyhow::Result<()> {
        self.script_tx
            .send(ScriptMsg::ReloadVarMap)
            .map_err(|e| anyhow::anyhow!("script engine unavailable: {e}"))
    }
}

pub fn spawn(
    store: Arc<Mutex<Store>>,
    scripts_dir: PathBuf,
    var_map_path: PathBuf,
) -> anyhow::Result<ScriptEngineHandle> {
    let (script_tx, script_rx) = std::sync::mpsc::channel::<ScriptMsg>();

    {
        let hook_tx = script_tx.clone();
        store
            .lock()
            .map_err(|_| anyhow::anyhow!("store lock poisoned"))?
            .set_write_hook(Arc::new(move |ev| {
                let _ = hook_tx.send(ScriptMsg::Write(ev));
            }));
    }

    let store_thread = Arc::clone(&store);
    let script_tx_thread = script_tx.clone();
    let thread = thread::Builder::new()
        .name("modbus-sim-js".into())
        .spawn(move || {
            if let Err(e) = run_script_thread(
                store_thread,
                scripts_dir,
                var_map_path,
                script_rx,
                script_tx_thread,
            ) {
                tracing::error!(error = %e, "simulation script thread exited");
            }
        })?;

    Ok(ScriptEngineHandle {
        script_tx,
        _thread: Arc::new(thread),
    })
}

fn run_script_thread(
    store: Arc<Mutex<Store>>,
    scripts_dir: PathBuf,
    var_map_path: PathBuf,
    script_rx: std::sync::mpsc::Receiver<ScriptMsg>,
    script_tx: std::sync::mpsc::Sender<ScriptMsg>,
) -> anyhow::Result<()> {
    let runtime = Runtime::new()?;
    let ctx = Context::full(&runtime)?;
    let pending_timers: Arc<Mutex<HashMap<u64, TimerRegistration>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let timer_generation = Arc::new(AtomicU64::new(0));

    ctx.with(|ctx| -> rquickjs::Result<()> {
        install_modbus_api(&ctx, Arc::clone(&store), Arc::clone(&pending_timers))?;
        ctx.eval::<(), _>(MODBUS_TYPED_API)?;
        inject_var_map_definitions(&ctx, &var_map_path)?;
        ctx.eval::<(), _>(MAP_TYPED_API)?;
        load_user_scripts(&ctx, &scripts_dir, &pending_timers)?;
        Ok(())
    })?;

    tracing::info!(dir = %scripts_dir.display(), "simulation scripts loaded");

    spawn_timers(
        &pending_timers,
        &script_tx,
        timer_generation.load(Ordering::SeqCst),
    );

    while let Ok(msg) = script_rx.recv() {
        match msg {
            ScriptMsg::Write(ev) => {
                if let Err(e) = dispatch_write(&ctx, &ev) {
                    tracing::warn!(
                        kind = ev.kind_str(),
                        addr = ev.addr,
                        error = %e,
                        "simulation onWrite failed"
                    );
                }
                drain_pending_writes(&ctx, &script_rx);
            }
            ScriptMsg::Timer { id, generation } => {
                if generation != timer_generation.load(Ordering::SeqCst) {
                    continue;
                }
                ctx.with(|ctx| {
                    let callbacks: Array = ctx.globals().get("__timerCallbacks")?;
                    let func: Function = callbacks.get(id as usize)?;
                    if let Err(caught) = func.call::<_, ()>(()).catch(&ctx) {
                        let script = timer_script_name(&ctx, id);
                        tracing::warn!(
                            timer_id = id,
                            script = %script,
                            error = %caught,
                            "simulation timer callback failed"
                        );
                    }
                    Ok::<(), rquickjs::Error>(())
                })
                .ok();
                drain_pending_writes(&ctx, &script_rx);
            }
            ScriptMsg::Reload => {
                if let Err(e) = reload_scripts(
                    &ctx,
                    &scripts_dir,
                    &pending_timers,
                    &script_tx,
                    &timer_generation,
                ) {
                    tracing::error!(error = %e, "simulation script reload failed");
                }
            }
            ScriptMsg::ReloadVarMap => {
                if let Err(e) = reload_var_map(&ctx, &var_map_path) {
                    tracing::error!(error = %e, "simulation var-map reload failed");
                }
            }
        }
    }

    Ok(())
}

fn drain_pending_writes(ctx: &Context, script_rx: &std::sync::mpsc::Receiver<ScriptMsg>) {
    while let Ok(ScriptMsg::Write(ev)) = script_rx.try_recv() {
        if let Err(e) = dispatch_write(ctx, &ev) {
            tracing::warn!(
                kind = ev.kind_str(),
                addr = ev.addr,
                error = %e,
                "simulation onWrite failed"
            );
        }
    }
}

fn reload_var_map(ctx: &Context, var_map_path: &Path) -> anyhow::Result<()> {
    ctx.with(|ctx| -> rquickjs::Result<()> {
        inject_var_map_definitions(&ctx, var_map_path)?;
        let install: Function = ctx.globals().get("__installMapApi")?;
        let _: () = install.call(())?;
        Ok(())
    })?;
    tracing::info!("simulation var-map reloaded");
    Ok(())
}

fn inject_var_map_definitions(ctx: &rquickjs::Ctx<'_>, path: &Path) -> rquickjs::Result<()> {
    let json = crate::service::var_map::definitions_json(path)
        .map_err(|e| rquickjs::Exception::throw_message(ctx, &e.to_string()))?;
    let script = format!("globalThis.__varMapDefinitions = {json};");
    ctx.eval::<(), _>(script.as_str())
}

fn timer_script_name(ctx: &rquickjs::Ctx<'_>, id: u64) -> String {
    ctx.globals()
        .get::<_, Array>("__timerScriptNames")
        .ok()
        .and_then(|names| names.get::<String>(id as usize).ok())
        .unwrap_or_else(|| "?".into())
}

fn reload_scripts(
    ctx: &Context,
    scripts_dir: &Path,
    pending_timers: &Arc<Mutex<HashMap<u64, TimerRegistration>>>,
    script_tx: &std::sync::mpsc::Sender<ScriptMsg>,
    timer_generation: &AtomicU64,
) -> anyhow::Result<()> {
    timer_generation.fetch_add(1, Ordering::SeqCst);
    pending_timers
        .lock()
        .map_err(|_| anyhow::anyhow!("timer lock"))?
        .clear();
    ctx.with(|ctx| -> rquickjs::Result<()> {
        clear_script_state(&ctx)?;
        load_user_scripts(&ctx, scripts_dir, pending_timers)?;
        Ok(())
    })?;
    spawn_timers(
        pending_timers,
        script_tx,
        timer_generation.load(Ordering::SeqCst),
    );
    tracing::info!("simulation scripts reloaded");
    Ok(())
}

fn spawn_timers(
    pending_timers: &Arc<Mutex<HashMap<u64, TimerRegistration>>>,
    script_tx: &std::sync::mpsc::Sender<ScriptMsg>,
    generation: u64,
) {
    let timers: HashMap<u64, TimerRegistration> = pending_timers
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .drain()
        .collect();
    for (timer_id, reg) in timers {
        let tx = script_tx.clone();
        let interval_ms = reg.interval_ms;
        thread::Builder::new()
            .name(format!("sim-timer-{timer_id}"))
            .spawn(move || loop {
                thread::sleep(Duration::from_millis(interval_ms));
                if tx
                    .send(ScriptMsg::Timer {
                        id: timer_id,
                        generation,
                    })
                    .is_err()
                {
                    break;
                }
            })
            .ok();
    }
}

fn clear_script_state(ctx: &rquickjs::Ctx<'_>) -> rquickjs::Result<()> {
    ctx.eval::<(), _>(
        r#"
        __writeHandlers.holding.length = 0;
        __writeHandlers.input.length = 0;
        __writeHandlers.coil.length = 0;
        __writeHandlers.discreteInput.length = 0;
        __timerCallbacks.length = 0;
        if (globalThis.__timerScriptNames) {
          __timerScriptNames.length = 0;
        }
        if (globalThis.__mapChangeHandlers) {
          for (var __mk in __mapChangeHandlers) {
            if (Object.prototype.hasOwnProperty.call(__mapChangeHandlers, __mk)) {
              delete __mapChangeHandlers[__mk];
            }
          }
        }
        if (globalThis.__mapChangeAllHandlers) {
          __mapChangeAllHandlers.length = 0;
        }
        "#,
    )
}

fn load_user_scripts(
    ctx: &rquickjs::Ctx<'_>,
    dir: &Path,
    pending_timers: &Arc<Mutex<HashMap<u64, TimerRegistration>>>,
) -> rquickjs::Result<()> {
    pending_timers
        .lock()
        .map_err(|_| rquickjs::Error::Unknown)?
        .clear();
    load_scripts_from_dir(ctx, dir)?;
    Ok(())
}

fn install_modbus_api<'js>(
    ctx: &rquickjs::Ctx<'js>,
    store: Arc<Mutex<Store>>,
    pending_timers: Arc<Mutex<HashMap<u64, TimerRegistration>>>,
) -> rquickjs::Result<()> {
    ctx.eval::<(), _>(
        r#"
        globalThis.__writeHandlers = { holding: [], input: [], coil: [], discreteInput: [] };
        globalThis.__timerCallbacks = [];
        globalThis.__timerScriptNames = [];
        globalThis.modbus = {
          onWrite: function(kind, fn) {
            if (!__writeHandlers[kind]) throw new Error('unknown kind: ' + kind);
            __writeHandlers[kind].push(fn);
          },
          setInterval: function(ms, fn) {
            var id = __timerCallbacks.length;
            __timerCallbacks.push(fn);
            __timerScriptNames.push(globalThis.__currentScriptName || '?');
            __native_registerTimer(id, ms);
            return id;
          },
          holdingRead: function(addr, count) { return __native_holdingRead(addr, count || 1); },
          inputRead: function(addr, count) { return __native_inputRead(addr, count || 1); },
          coilRead: function(addr, count) { return __native_coilRead(addr, count || 1); },
          discreteInputRead: function(addr, count) { return __native_discreteInputRead(addr, count || 1); },
          holdingWrite: function(addr, value) {
            if (Array.isArray(value)) __native_holdingWriteArray(addr, value);
            else __native_holdingWrite(addr, value);
          },
          inputWrite: function(addr, value) {
            if (Array.isArray(value)) __native_inputWriteArray(addr, value);
            else __native_inputWrite(addr, value);
          },
          coilWrite: function(addr, value) {
            if (Array.isArray(value)) __native_coilWriteArray(addr, value);
            else __native_coilWrite(addr, value);
          },
          discreteInputWrite: function(addr, value) {
            if (Array.isArray(value)) __native_discreteInputWriteArray(addr, value);
            else __native_discreteInputWrite(addr, value);
          },
        };
        function __dispatchWrite(kind, addr, values) {
          var list = __writeHandlers[kind] || [];
          for (var i = 0; i < list.length; i++) list[i](addr, values);
        }
        "#,
    )?;

    let store_hr = Arc::clone(&store);
    ctx.globals().set(
        "__native_holdingRead",
        Func::from(
            move |ctx, addr: u16, count: u16| -> rquickjs::Result<Value<'js>> {
                let data = store_hr
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?
                    .holding_registers_read(addr, count.max(1))
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                values_to_js(&ctx, &data.iter().map(|v| *v as i32).collect::<Vec<_>>())
            },
        ),
    )?;

    let store_ir = Arc::clone(&store);
    ctx.globals().set(
        "__native_inputRead",
        Func::from(
            move |ctx, addr: u16, count: u16| -> rquickjs::Result<Value<'js>> {
                let data = store_ir
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?
                    .input_registers_read(addr, count.max(1))
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                values_to_js(&ctx, &data.iter().map(|v| *v as i32).collect::<Vec<_>>())
            },
        ),
    )?;

    let store_cr = Arc::clone(&store);
    ctx.globals().set(
        "__native_coilRead",
        Func::from(
            move |ctx, addr: u16, count: u16| -> rquickjs::Result<Value<'js>> {
                let data = store_cr
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?
                    .discrete_coils_read(addr, count.max(1))
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                bools_to_js(&ctx, &data)
            },
        ),
    )?;

    let store_di = Arc::clone(&store);
    ctx.globals().set(
        "__native_discreteInputRead",
        Func::from(
            move |ctx, addr: u16, count: u16| -> rquickjs::Result<Value<'js>> {
                let data = store_di
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?
                    .discrete_input_read(addr, count.max(1))
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                bools_to_js(&ctx, &data)
            },
        ),
    )?;

    let store_hw = Arc::clone(&store);
    ctx.globals().set(
        "__native_holdingWriteArray",
        Func::from(
            move |ctx, addr: u16, values: Array| -> rquickjs::Result<()> {
                let words = js_array_to_u16(values)?;
                let mut s = store_hw
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.holding_registers_write(addr, &words)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_iw = Arc::clone(&store);
    ctx.globals().set(
        "__native_inputWriteArray",
        Func::from(
            move |ctx, addr: u16, values: Array| -> rquickjs::Result<()> {
                let words = js_array_to_u16(values)?;
                let mut s = store_iw
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.input_registers_write(addr, &words)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_hw = Arc::clone(&store);
    ctx.globals().set(
        "__native_holdingWrite",
        Func::from(move |ctx, addr: u16, value: u16| -> rquickjs::Result<()> {
            let mut s = store_hw
                .lock()
                .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
            s.holding_registers_write(addr, std::slice::from_ref(&value))
                .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
            Ok(())
        }),
    )?;

    let store_iw = Arc::clone(&store);
    ctx.globals().set(
        "__native_inputWrite",
        Func::from(move |ctx, addr: u16, value: u16| -> rquickjs::Result<()> {
            let mut s = store_iw
                .lock()
                .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
            s.input_registers_write(addr, std::slice::from_ref(&value))
                .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
            Ok(())
        }),
    )?;

    let store_hwa = Arc::clone(&store);
    ctx.globals().set(
        "__native_holdingWriteArray",
        Func::from(
            move |ctx, addr: u16, values: Array| -> rquickjs::Result<()> {
                let words = js_array_to_u16(values)?;
                let mut s = store_hwa
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.holding_registers_write(addr, &words)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_iwa = Arc::clone(&store);
    ctx.globals().set(
        "__native_inputWriteArray",
        Func::from(
            move |ctx, addr: u16, values: Array| -> rquickjs::Result<()> {
                let words = js_array_to_u16(values)?;
                let mut s = store_iwa
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.input_registers_write(addr, &words)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_hwm = Arc::clone(&store);
    ctx.globals().set(
        "__native_holdingWriteMany",
        Func::from(
            move |ctx, addr: u16, Rest(values): Rest<u16>| -> rquickjs::Result<()> {
                let mut s = store_hwm
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.holding_registers_write(addr, &values)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_iwm = Arc::clone(&store);
    ctx.globals().set(
        "__native_inputWriteMany",
        Func::from(
            move |ctx, addr: u16, Rest(values): Rest<u16>| -> rquickjs::Result<()> {
                let mut s = store_iwm
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.input_registers_write(addr, &values)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_cw = Arc::clone(&store);
    ctx.globals().set(
        "__native_coilWrite",
        Func::from(move |ctx, addr: u16, value: bool| -> rquickjs::Result<()> {
            let mut s = store_cw
                .lock()
                .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
            s.discrete_coil_write(addr, std::slice::from_ref(&value))
                .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
            Ok(())
        }),
    )?;

    let store_cwa = Arc::clone(&store);
    ctx.globals().set(
        "__native_coilWriteArray",
        Func::from(
            move |ctx, addr: u16, values: Array| -> rquickjs::Result<()> {
                let bits = js_array_to_bool(values)?;
                let mut s = store_cwa
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.discrete_coil_write(addr, &bits)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_cwm = Arc::clone(&store);
    ctx.globals().set(
        "__native_coilWriteMany",
        Func::from(
            move |ctx, addr: u16, Rest(values): Rest<bool>| -> rquickjs::Result<()> {
                let mut s = store_cwm
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.discrete_coil_write(addr, &values)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_diw = Arc::clone(&store);
    ctx.globals().set(
        "__native_discreteInputWrite",
        Func::from(move |ctx, addr: u16, value: bool| -> rquickjs::Result<()> {
            let mut s = store_diw
                .lock()
                .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
            s.discrete_input_write(addr, std::slice::from_ref(&value))
                .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
            Ok(())
        }),
    )?;

    let store_diwa = Arc::clone(&store);
    ctx.globals().set(
        "__native_discreteInputWriteArray",
        Func::from(
            move |ctx, addr: u16, values: Array| -> rquickjs::Result<()> {
                let bits = js_array_to_bool(values)?;
                let mut s = store_diwa
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.discrete_input_write(addr, &bits)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let store_diwm = Arc::clone(&store);
    ctx.globals().set(
        "__native_discreteInputWriteMany",
        Func::from(
            move |ctx, addr: u16, Rest(values): Rest<bool>| -> rquickjs::Result<()> {
                let mut s = store_diwm
                    .lock()
                    .map_err(|_| rquickjs::Exception::throw_message(&ctx, "store lock"))?;
                s.discrete_input_write(addr, &values)
                    .map_err(|e| rquickjs::Exception::throw_message(&ctx, &e.to_string()))?;
                Ok(())
            },
        ),
    )?;

    let pending = Arc::clone(&pending_timers);
    ctx.globals().set(
        "__native_registerTimer",
        Func::from(
            move |ctx: rquickjs::Ctx<'js>, id: u32, ms: u32| -> rquickjs::Result<()> {
                let _ = ctx;
                let interval_ms = ms.max(1) as u64;
                pending
                    .lock()
                    .map_err(|_| rquickjs::Error::Unknown)?
                    .insert(id as u64, TimerRegistration { interval_ms });
                Ok(())
            },
        ),
    )?;

    Ok(())
}

fn js_array_to_u16(values: Array<'_>) -> rquickjs::Result<Vec<u16>> {
    let len = values.len();
    let mut out = Vec::with_capacity(len);
    for i in 0..len {
        let v: i32 = values.get(i)?;
        out.push(v as u16);
    }
    Ok(out)
}

fn js_array_to_bool(values: Array<'_>) -> rquickjs::Result<Vec<bool>> {
    let len = values.len();
    let mut out = Vec::with_capacity(len);
    for i in 0..len {
        out.push(values.get::<bool>(i)?);
    }
    Ok(out)
}

fn values_to_js<'js>(ctx: &rquickjs::Ctx<'js>, data: &[i32]) -> rquickjs::Result<Value<'js>> {
    if data.len() == 1 {
        return Ok(Value::new_int(ctx.clone(), data[0]));
    }
    let arr = Array::new(ctx.clone())?;
    for (i, v) in data.iter().enumerate() {
        arr.set(i, *v)?;
    }
    Ok(arr.into_value())
}

fn bools_to_js<'js>(ctx: &rquickjs::Ctx<'js>, data: &[bool]) -> rquickjs::Result<Value<'js>> {
    if data.len() == 1 {
        return Ok(Value::new_bool(ctx.clone(), data[0]));
    }
    let arr = Array::new(ctx.clone())?;
    for (i, v) in data.iter().enumerate() {
        arr.set(i, *v)?;
    }
    Ok(arr.into_value())
}

fn write_values_to_js<'js>(
    ctx: &rquickjs::Ctx<'js>,
    values: &WriteValues,
) -> rquickjs::Result<Value<'js>> {
    match values {
        WriteValues::U16(v) => {
            if v.len() == 1 {
                Ok(Value::new_int(ctx.clone(), v[0] as i32))
            } else {
                let arr = Array::new(ctx.clone())?;
                for (i, n) in v.iter().enumerate() {
                    arr.set(i, *n as i32)?;
                }
                Ok(arr.into_value())
            }
        }
        WriteValues::Bool(v) => bools_to_js(ctx, v),
    }
}

fn dispatch_write(ctx: &Context, ev: &WriteEvent) -> anyhow::Result<()> {
    ctx.with(|ctx| -> rquickjs::Result<()> {
        let dispatch: Function = ctx.globals().get("__dispatchWrite")?;
        let values = write_values_to_js(&ctx, &ev.values)?;
        dispatch.call::<_, ()>((ev.kind_str(), ev.addr, values.clone()))?;
        if let Ok(map_dispatch) = ctx.globals().get::<_, Function>("__dispatchMapChange") {
            let _: () = map_dispatch.call((ev.kind_str(), ev.addr, values))?;
        }
        Ok(())
    })?;
    Ok(())
}

fn wrap_user_script(source: &str) -> String {
    // Each reload re-evaluates in the same QuickJS realm; top-level let/const would throw.
    format!("(function() {{\n{source}\n}})();")
}

fn load_scripts_from_dir(ctx: &rquickjs::Ctx<'_>, dir: &Path) -> rquickjs::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .map_err(|e| rquickjs::Exception::throw_message(ctx, &e.to_string()))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "js"))
        .collect();
    files.sort();
    for path in files {
        let source = std::fs::read_to_string(&path)
            .map_err(|e| rquickjs::Exception::throw_message(ctx, &e.to_string()))?;
        let name = path.display().to_string();
        let wrapped = wrap_user_script(&source);
        let load_script = format!(
            "globalThis.__currentScriptName = {name_json:?};\n{wrapped}",
            name_json = name,
            wrapped = wrapped
        );
        ctx.eval::<(), _>(load_script.as_str()).map_err(|e| {
            rquickjs::Exception::throw_message(ctx, &format!("{name}: {e}"))
        })?;
        tracing::debug!(script = %name, "loaded simulation script");
    }
    Ok(())
}
