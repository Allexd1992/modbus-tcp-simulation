use rocket_okapi::swagger_ui::make_swagger_ui;
use rocket_okapi::openapi;
use rocket_okapi::routes::OpenApiFromRequest;
use rocket_okapi::*;
use rocket_okapi::request;
use rocket::data::ByteUnit;
use rocket::{State, post, get};
use rocket::http::Status;
use rocket::Data;

#[openapi]
#[get("/swagger.json")]
fn openapi_spec() -> Result<Json<Swagger>, NotFound<String>> {
    // Создайте спецификацию Swagger здесь, описывая ваше API
    let spec = rocket_okapi::swagger::create_swagger_spec::<MyApiRoutes>();
    Ok(Json(spec))
}

#[get("/")]
fn index() -> impl Responder<'static> {
    make_swagger_ui(&openapi_spec().unwrap().0, "/swagger.json")
}


struct MyApiRoutes;

#[openapi]
impl OpenApiFromRequest for MyApiRoutes {
    fn path() -> rocket_okapi::schemars::schema::Path {
        rocket_okapi::schemars::schema::Path::new("/")
    }
}
