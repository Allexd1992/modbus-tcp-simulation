use rocket::http::{ContentType, Header, Status};
use rocket::request::Request;
use rocket::response::{self, Responder, Response};

pub struct Attachment {
    pub content_type: ContentType,
    pub filename: String,
    pub data: Vec<u8>,
}

impl<'r> Responder<'r, 'static> for Attachment {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        Response::build()
            .header(self.content_type)
            .header(Header::new(
                "Content-Disposition",
                format!("attachment; filename=\"{}\"", self.filename),
            ))
            .sized_body(self.data.len(), std::io::Cursor::new(self.data))
            .ok()
    }
}

pub fn map_io_err(e: std::io::Error) -> Status {
    match e.kind() {
        std::io::ErrorKind::NotFound => Status::NotFound,
        std::io::ErrorKind::InvalidInput | std::io::ErrorKind::InvalidData => Status::BadRequest,
        std::io::ErrorKind::Unsupported => Status::ServiceUnavailable,
        _ => Status::InternalServerError,
    }
}
