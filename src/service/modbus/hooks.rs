use std::sync::Arc;

#[derive(Clone, Debug)]
pub enum RegisterKind {
    Holding,
    Input,
    Coil,
    DiscreteInput,
}

#[derive(Clone, Debug)]
pub enum WriteValues {
    U16(Vec<u16>),
    Bool(Vec<bool>),
}

#[derive(Clone, Debug)]
pub struct WriteEvent {
    pub kind: RegisterKind,
    pub addr: u16,
    pub values: WriteValues,
}

impl WriteEvent {
    pub fn kind_str(&self) -> &'static str {
        match self.kind {
            RegisterKind::Holding => "holding",
            RegisterKind::Input => "input",
            RegisterKind::Coil => "coil",
            RegisterKind::DiscreteInput => "discreteInput",
        }
    }
}

pub type WriteHook = Arc<dyn Fn(WriteEvent) + Send + Sync>;
