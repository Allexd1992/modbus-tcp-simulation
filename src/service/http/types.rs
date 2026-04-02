use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct RequestRegister {
    #[schema(example = json!([123,1234]))]
    pub data: Vec<u16>,
}
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct RequestCoil {
    #[schema(example = json!([true, false,true]))]
    pub data: Vec<bool>,
}
