import FileStorage "file-storage/file-storage";
import Http "file-storage/http";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";
import Array "mo:base/Array";

persistent actor {
    // HTTP Outcalls Types
    type HttpRequestArgs = {
        url : Text;
        max_response_bytes : ?Nat64;
        headers : [HttpHeader];
        body : ?[Nat8];
        method : HttpMethod;
        transform : ?TransformRawResponseFunction;
    };

    type HttpHeader = {
        name : Text;
        value : Text;
    };

    type HttpMethod = {
        #get;
        #post;
        #head;
    };

    type HttpResponsePayload = {
        status : Nat;
        headers : [HttpHeader];
        body : [Nat8];
    };

    type TransformRawResponseFunction = {
        function : shared query TransformRawResponseArgs -> async HttpResponsePayload;
        context : Blob;
    };

    type TransformRawResponseArgs = {
        response : HttpResponsePayload;
        context : Blob;
    };

    // IC Management Canister Interface
    type IC = actor {
        http_request : HttpRequestArgs -> async HttpResponsePayload;
    };
    var storage = FileStorage.new();

    transient let natMap = OrderedMap.Make<Nat>(Nat.compare);
    transient let textMap = OrderedMap.Make<Text>(Text.compare);
    var ocrRatings : OrderedMap.Map<Nat, Nat> = natMap.empty<Nat>();
    var nextDocId : Nat = 0;
    
    // OCR Results Storage
    var egyptianIdResults : OrderedMap.Map<Text, Text> = textMap.empty<Text>();
    var passportResults : OrderedMap.Map<Text, Text> = textMap.empty<Text>();

    // IC Management Canister for HTTP Outcalls
    let ic : IC = actor ("aaaaa-aa");
    
    // OCR Server Configuration
    let OCR_SERVER_BASE_URL = "http://194.31.150.154:5000";

    // Transform function for HTTP responses
    public query func transform_response(raw : TransformRawResponseArgs) : async HttpResponsePayload {
        let transformed : HttpResponsePayload = {
            status = raw.response.status;
            body = raw.response.body;
            headers = [
                {
                    name = "Content-Security-Policy";
                    value = "default-src 'self'";
                },
                {
                    name = "Referrer-Policy";
                    value = "strict-origin";
                },
            ];
        };
        transformed;
    };

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

    // OCR HTTP Outcalls Integration
    
    public func getOcrHealth() : async Text {
        try {
            // Add cycles for HTTP outcall (required)
            Cycles.add<system>(20_000_000_000);
            
            let request : HttpRequestArgs = {
                url = OCR_SERVER_BASE_URL # "/health";
                max_response_bytes = ?1024;
                headers = [
                    { name = "Content-Type"; value = "application/json" }
                ];
                body = null;
                method = #get;
                transform = ?{
                    function = transform_response;
                    context = Blob.fromArray([]);
                };
            };

            let response = await ic.http_request(request);
            
            // Convert response body from [Nat8] to Text
            let responseText = switch (Text.decodeUtf8(Blob.fromArray(response.body))) {
                case (?text) { text };
                case null { "Failed to decode response" };
            };
            
            responseText;
        } catch (error) {
            "Health check failed: HTTP outcall error";
        };
    };

    public func getEgyptianIdOcr(path : Text) : async Text {
        try {
            // Get image data from storage
            let asset = switch(FileStorage.getAsset(storage, path)) {
                case null { Debug.trap("Asset not found"); };
                case (?asset) { asset };
            };

            let imageData = asset.chunks[0];
            
            // Add cycles for HTTP outcall (more for image processing)
            Cycles.add<system>(50_000_000_000);
            
            let request : HttpRequestArgs = {
                url = OCR_SERVER_BASE_URL # "/egyptian-id";
                max_response_bytes = ?10_000; // Larger response for OCR results
                headers = [
                    { name = "Content-Type"; value = "application/octet-stream" }
                ];
                body = ?Blob.toArray(imageData);
                method = #post;
                transform = ?{
                    function = transform_response;
                    context = Blob.fromArray([]);
                };
            };

            let response = await ic.http_request(request);
            
            // Convert response body from [Nat8] to Text
            let ocrResult = switch (Text.decodeUtf8(Blob.fromArray(response.body))) {
                case (?text) { 
                    // Save the OCR result to persistent storage
                    egyptianIdResults := textMap.put(egyptianIdResults, path, text);
                    text;
                };
                case null { 
                    let errorResult = "{\"status\":\"error\",\"message\":\"Failed to decode OCR response\",\"data\":null}";
                    egyptianIdResults := textMap.put(egyptianIdResults, path, errorResult);
                    errorResult;
                };
            };
            
            ocrResult;
        } catch (error) {
            let errorResult = "{\"status\":\"error\",\"message\":\"HTTP outcall failed\",\"data\":null}";
            egyptianIdResults := textMap.put(egyptianIdResults, path, errorResult);
            errorResult;
        };
    };

    public func getPassportOcr(path : Text) : async Text {
        try {
            // Get image data from storage
            let asset = switch(FileStorage.getAsset(storage, path)) {
                case null { Debug.trap("Asset not found"); };
                case (?asset) { asset };
            };

            let imageData = asset.chunks[0];
            
            // Add cycles for HTTP outcall (more for image processing)
            Cycles.add<system>(50_000_000_000);
            
            let request : HttpRequestArgs = {
                url = OCR_SERVER_BASE_URL # "/passport";
                max_response_bytes = ?10_000; // Larger response for OCR results
                headers = [
                    { name = "Content-Type"; value = "application/octet-stream" }
                ];
                body = ?Blob.toArray(imageData);
                method = #post;
                transform = ?{
                    function = transform_response;
                    context = Blob.fromArray([]);
                };
            };

            let response = await ic.http_request(request);
            
            // Convert response body from [Nat8] to Text
            let ocrResult = switch (Text.decodeUtf8(Blob.fromArray(response.body))) {
                case (?text) { 
                    // Save the OCR result to persistent storage
                    passportResults := textMap.put(passportResults, path, text);
                    text;
                };
                case null { 
                    let errorResult = "{\"status\":\"error\",\"message\":\"Failed to decode OCR response\",\"data\":null}";
                    passportResults := textMap.put(passportResults, path, errorResult);
                    errorResult;
                };
            };
            
            ocrResult;
        } catch (error) {
            let errorResult = "{\"status\":\"error\",\"message\":\"HTTP outcall failed\",\"data\":null}";
            passportResults := textMap.put(passportResults, path, errorResult);
            errorResult;
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
