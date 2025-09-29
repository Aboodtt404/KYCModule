import FileStorage "file-storage/file-storage";
import Http "file-storage/http";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";
// Removed unused Array import

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

    // Use stable storage types for persistent actor
    stable var ocrRatings : [(Nat, Nat)] = [];
    stable var nextDocId : Nat = 0;
    
    // OCR Results Storage - using arrays for stability
    stable var egyptianIdResults : [(Text, Text)] = [];
    stable var passportResults : [(Text, Text)] = [];
    
    // Helper functions to work with stable arrays
    // Note: Map instances are created locally in functions to avoid stability issues

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
        // Handle API routes
        if (Text.startsWith(request.url, #text("/api/"))) {
            handleApiRequestSync(request);
        } else {
            // Serve static files for non-API routes
            FileStorage.fileRequest(storage, request, httpStreamingCallback);
        };
    };

    public query func httpStreamingCallback(token : Http.StreamingToken) : async Http.StreamingCallbackHttpResponse {
        FileStorage.httpStreamingCallback(storage, token);
    };

    public func rateOcrQuality(docId : Nat, rating : Nat) : async () {
        let natMap = OrderedMap.Make<Nat>(Nat.compare);
        let map = natMap.fromIter(ocrRatings.vals());
        let newMap = natMap.put(map, docId, rating);
        ocrRatings := Iter.toArray(natMap.entries(newMap));
    };

    public func getOcrRating(docId : Nat) : async ?Nat {
        let natMap = OrderedMap.Make<Nat>(Nat.compare);
        let map = natMap.fromIter(ocrRatings.vals());
        natMap.get(map, docId);
    };

    public func getAllOcrRatings() : async [(Nat, Nat)] {
        ocrRatings;
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
                max_response_bytes = ?100_000;
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
        } catch (_error) {
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
                max_response_bytes = ?100_000; // Larger response for OCR results
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
                    let textMap = OrderedMap.Make<Text>(Text.compare);
                    let map = textMap.fromIter(egyptianIdResults.vals());
                    let newMap = textMap.put(map, path, text);
                    egyptianIdResults := Iter.toArray(textMap.entries(newMap));
                    text;
                };
                case null { 
                    let errorResult = "{\"status\":\"error\",\"message\":\"Failed to decode OCR response\",\"data\":null}";
                    let textMap = OrderedMap.Make<Text>(Text.compare);
                    let map = textMap.fromIter(egyptianIdResults.vals());
                    let newMap = textMap.put(map, path, errorResult);
                    egyptianIdResults := Iter.toArray(textMap.entries(newMap));
                    errorResult;
                };
            };
            
            ocrResult;
        } catch (_error) {
            let errorResult = "{\"status\":\"error\",\"message\":\"HTTP outcall failed\",\"data\":null}";
            let textMap = OrderedMap.Make<Text>(Text.compare);
            let map = textMap.fromIter(egyptianIdResults.vals());
            let newMap = textMap.put(map, path, errorResult);
            egyptianIdResults := Iter.toArray(textMap.entries(newMap));
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
                max_response_bytes = ?100_000; // Larger response for OCR results
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
                    let textMap = OrderedMap.Make<Text>(Text.compare);
                    let map = textMap.fromIter(passportResults.vals());
                    let newMap = textMap.put(map, path, text);
                    passportResults := Iter.toArray(textMap.entries(newMap));
                    text;
                };
                case null { 
                    let errorResult = "{\"status\":\"error\",\"message\":\"Failed to decode OCR response\",\"data\":null}";
                    let textMap = OrderedMap.Make<Text>(Text.compare);
                    let map = textMap.fromIter(passportResults.vals());
                    let newMap = textMap.put(map, path, errorResult);
                    passportResults := Iter.toArray(textMap.entries(newMap));
                    errorResult;
                };
            };
            
            ocrResult;
        } catch (_error) {
            let errorResult = "{\"status\":\"error\",\"message\":\"HTTP outcall failed\",\"data\":null}";
            let textMap = OrderedMap.Make<Text>(Text.compare);
            let map = textMap.fromIter(passportResults.vals());
            let newMap = textMap.put(map, path, errorResult);
            passportResults := Iter.toArray(textMap.entries(newMap));
            errorResult;
        };
    };

    // Functions to retrieve stored OCR results
    public func getEgyptianIdResult(path : Text) : async ?Text {
        let textMap = OrderedMap.Make<Text>(Text.compare);
        let map = textMap.fromIter(egyptianIdResults.vals());
        textMap.get(map, path);
    };

    public func getPassportResult(path : Text) : async ?Text {
        let textMap = OrderedMap.Make<Text>(Text.compare);
        let map = textMap.fromIter(passportResults.vals());
        textMap.get(map, path);
    };

    public func getAllEgyptianIdResults() : async [(Text, Text)] {
        egyptianIdResults;
    };

    public func getAllPassportResults() : async [(Text, Text)] {
        passportResults;
    };

    public func deleteEgyptianIdResult(path : Text) : async () {
        let textMap = OrderedMap.Make<Text>(Text.compare);
        let map = textMap.fromIter(egyptianIdResults.vals());
        let (newMap, _) = textMap.remove(map, path);
        egyptianIdResults := Iter.toArray(textMap.entries(newMap));
    };

    public func deletePassportResult(path : Text) : async () {
        let textMap = OrderedMap.Make<Text>(Text.compare);
        let map = textMap.fromIter(passportResults.vals());
        let (newMap, _) = textMap.remove(map, path);
        passportResults := Iter.toArray(textMap.entries(newMap));
    };

    // API Request Handler (Synchronous for query functions)
    private func handleApiRequestSync(request : Http.HttpRequest) : Http.HttpResponse {
        if (request.url == "/api/process-document") {
            handleProcessDocumentSync(request);
        } else {
            // Return 404 for unknown API endpoints
            {
                status_code = 404;
                headers = [("Content-Type", "application/json")];
                body = Text.encodeUtf8("{\"error\":\"Not Found\"}");
                streaming_strategy = null;
            };
        };
    };

    // Process Document API Endpoint (Synchronous)
    private func handleProcessDocumentSync(_request : Http.HttpRequest) : Http.HttpResponse {
        // For now, return a mock response since we need to implement proper JSON parsing
        // TODO: Implement proper JSON parsing and OCR processing
        {
            status_code = 200;
            headers = [("Content-Type", "application/json")];
            body = Text.encodeUtf8("{\"success\":true,\"data\":{\"name\":\"Sample Name\",\"idNumber\":\"123456789\",\"birthDate\":\"1990-01-01\"}}");
            streaming_strategy = null;
        };
    };
};