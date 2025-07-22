import Outcalls "http-outcalls/outcalls";
import FileStorage "file-storage/file-storage";
import Http "file-storage/http";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import IC "ic:aaaaa-aa";

persistent actor {
    var storage = FileStorage.new();

    transient let natMap = OrderedMap.Make<Nat>(Nat.compare);
    var ocrRatings : OrderedMap.Map<Nat, Nat> = natMap.empty<Nat>();
    var nextDocId : Nat = 0;

    public func list() : async [FileStorage.FileMetadata] {
        FileStorage.list(storage);
    };

    public func upload(path : Text, mimeType : Text, chunk : Blob, complete : Bool) : async () {
        FileStorage.upload(storage, path, mimeType, chunk, complete);
    };

    public func delete_(path : Text) : async () {
        FileStorage.delete(storage, path);
    };

    public query func http_request(request : Http.HttpRequest) : async Http.HttpResponse {
        FileStorage.fileRequest(storage, request, httpStreamingCallback);
    };

    public query func httpStreamingCallback(token : Http.StreamingToken) : async Http.StreamingCallbackHttpResponse {
        FileStorage.httpStreamingCallback(storage, token);
    };

    public func rateOcrQuality(docId : Nat, rating : Nat) : async () {
        ocrRatings := natMap.put(ocrRatings, docId, rating);
    };

    public func getOcrRating(docId : Nat) : async ?Nat {
        natMap.get(ocrRatings, docId);
    };

    public func getAllOcrRatings() : async [(Nat, Nat)] {
        Iter.toArray(natMap.entries(ocrRatings));
    };

    public func addDocument(path : Text, mimeType : Text, chunk : Blob, complete : Bool) : async Nat {
        let docId = nextDocId;
        nextDocId += 1;
        FileStorage.upload(storage, path, mimeType, chunk, complete);
        docId;
    };
};
