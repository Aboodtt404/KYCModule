import FileStorage "file-storage/file-storage";
import Http "file-storage/http";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import OCRCanister "canister:ocr_canister";

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

    // OCR Canister Integration - No more HTTP outcalls needed!
    
    public func getOcrHealth() : async Text {
        // Check OCR canister health
        await OCRCanister.health_check();
    };

    public func getEgyptianIdOcr(path : Text) : async Text {
        // Get image data from storage
        let asset = switch(FileStorage.getAsset(storage, path)) {
            case null { Debug.trap("Asset not found"); };
            case (?asset) { asset };
        };

        let imageData = asset.chunks[0];
        
        // Call OCR canister directly - no HTTP outcalls!
        let ocrResult = await OCRCanister.process_egyptian_id(imageData);
        
        // Save the OCR result to persistent storage
        egyptianIdResults := textMap.put(egyptianIdResults, path, ocrResult);
        
        ocrResult;
    };

    public func getPassportOcr(path : Text) : async Text {
        // Get image data from storage
        let asset = switch(FileStorage.getAsset(storage, path)) {
            case null { Debug.trap("Asset not found"); };
            case (?asset) { asset };
        };

        let imageData = asset.chunks[0];
        
        // Call OCR canister directly - no HTTP outcalls!
        let ocrResult = await OCRCanister.process_passport(imageData);
        
        // Save the OCR result to persistent storage
        passportResults := textMap.put(passportResults, path, ocrResult);
        
        ocrResult;
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
