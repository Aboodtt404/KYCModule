import Blob "mo:base/Blob";
import Text "mo:base/Text";
import IC "ic:aaaaa-aa";

module {
  public type TransformationInput = {
    context : Blob;
    response : IC.http_request_result;
  };
  public type TransformationOutput = IC.http_request_result;

  public type Header = {
    name: Text;
    value: Text;
  };
};
