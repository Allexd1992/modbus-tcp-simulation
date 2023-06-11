use ::serde::{Serialize, Deserialize};

#[derive(Serialize,Deserialize,Clone,Debug)]
pub struct RequestRegister {

  pub  data:Vec<u16>
}
#[derive(Serialize,Deserialize,Clone,Debug)]
pub struct RequestCoil {

  pub  data:Vec<bool>
}