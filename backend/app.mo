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
    transient let textMap = OrderedMap.Make<Text>(Text.compare);
    var ocrRatings : OrderedMap.Map<Nat, Nat> = natMap.empty<Nat>();
    var nextDocId : Nat = 0;
    
    // OCR Results Storage
    var egyptianIdResults : OrderedMap.Map<Text, Text> = textMap.empty<Text>();
    var passportResults : OrderedMap.Map<Text, Text> = textMap.empty<Text>();

    public func list() : async [FileStorage.FileMetadata] {
        FileStorage.list(storage);
    };

    public func upload(path : Text, mimeType : Text, chunk : Blob, complete : Bool) : async () {
        FileStorage.upload(storage, path, mimeType, chunk, complete);
    };

    public shared func delete(path : Text) : async () {
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

    public shared query func transform(input : Outcalls.TransformationInput) : async Outcalls.TransformationOutput {
        let response = input.response;
        {
            response with headers = [];
        };
    };

    public func getEgyptianIdOcr(path : Text) : async Text {
        let ocrServiceUrl = "http://194.31.150.154:5000/egyptian-id";

        let asset = switch(FileStorage.getAsset(storage, path)) {
            case null { Debug.trap("Asset not found"); };
            case (?asset) { asset };
        };

        let requestBody = asset.chunks[0];
        
        let request : IC.http_request_args = {
            url = ocrServiceUrl;
            max_response_bytes = null;
            headers = [];
            body = ?requestBody;
            method = #post;
            transform = ?{
                function = transform;
                context = Blob.fromArray([]);
            };
            is_replicated = null;
        };

        let httpResponse = await (with cycles = 25_000_000_000) IC.http_request(request);

        switch (Text.decodeUtf8(httpResponse.body)) {
            case (null) { Debug.trap("empty HTTP response") };
            case (?decodedResponse) { 
                // Save the OCR result to persistent storage
                egyptianIdResults := textMap.put(egyptianIdResults, path, decodedResponse);
                decodedResponse;
            };
        };
    };

    public func getPassportOcr(path : Text) : async Text {
        let ocrServiceUrl = "http://194.31.150.154:5000/passport";

        let asset = switch(FileStorage.getAsset(storage, path)) {
            case null { Debug.trap("Asset not found"); };
            case (?asset) { asset };
        };

        let requestBody = asset.chunks[0];
        
        let request : IC.http_request_args = {
            url = ocrServiceUrl;
            max_response_bytes = null;
            headers = [];
            body = ?requestBody;
            method = #post;
            transform = ?{
                function = transform;
                context = Blob.fromArray([]);
            };
            is_replicated = null;
        };

        let httpResponse = await (with cycles = 25_000_000_000) IC.http_request(request);

        switch (Text.decodeUtf8(httpResponse.body)) {
            case (null) { Debug.trap("empty HTTP response") };
            case (?decodedResponse) { 
                // Save the OCR result to persistent storage
                passportResults := textMap.put(passportResults, path, decodedResponse);
                decodedResponse;
            };
        };
    };

    // Functions to retrieve stored OCR results
    public func getEgyptianIdResult(path : Text) : async ?Text {
        textMap.get(egyptianIdResults, path);
    };

    public func getPassportResult(path : Text) : async ?Text {
        textMap.get(passportResults, path);
    };

    public func getAllEgyptianIdResults() : async [(Text, Text)] {
        Iter.toArray(textMap.entries(egyptianIdResults));
    };

    public func getAllPassportResults() : async [(Text, Text)] {
        Iter.toArray(textMap.entries(passportResults));
    };

    public func deleteEgyptianIdResult(path : Text) : async () {
        let (newMap, _) = textMap.remove(egyptianIdResults, path);
        egyptianIdResults := newMap;
    };

    public func deletePassportResult(path : Text) : async () {
        let (newMap, _) = textMap.remove(passportResults, path);
        passportResults := newMap;
    };
};
