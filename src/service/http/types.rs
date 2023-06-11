use serde::{Serialize, Deserialize};
use utoipa::ToSchema;


#[derive(Debug)]
#[derive(Serialize,Deserialize,Clone, ToSchema)]
pub struct RequestRegister {
  #[schema(example = json!([123,1234]))]
  pub  data:Vec<u16>
}
#[derive(Debug)]
#[derive(Serialize,Deserialize,Clone, ToSchema)]
pub struct RequestCoil {
  #[schema(example = json!([true, false,true]))]
  pub  data:Vec<bool>
}


