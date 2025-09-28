import React, { useState } from "react";
import { useDocuments, useOCRRatings, useRateOCR } from "../../../useQueries";
import { useFileList } from "../../components/shared/FileList";
import { Star, Image, Loader2 } from "lucide-react";
export function OCRRating() {
    const { data: documents } = useDocuments();
    const { data: ratings } = useOCRRatings();
    const { getFileUrl } = useFileList();
    const rateOCRMutation = useRateOCR();
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageUrl, setImageUrl] = useState("");
    const [currentRating, setCurrentRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const imageFiles = documents?.filter((doc) => doc.mimeType.startsWith("image/")) || [];
    const loadImage = async (file, index) => {
        try {
            const url = await getFileUrl(file);
            setImageUrl(url);
            setSelectedImage(file);
            const existingRating = ratings?.find(([docId]) => Number(docId) === index);
            setCurrentRating(existingRating ? Number(existingRating[1]) : 0);
        }
        catch (error) {
            console.error("Failed to load image:", error);
        }
    };
    const handleRating = async (rating, docIndex) => {
        try {
            await rateOCRMutation.mutateAsync({
                docId: BigInt(docIndex),
                rating: BigInt(rating),
            });
            setCurrentRating(rating);
        }
        catch (error) {
            console.error("Failed to save rating:", error);
        }
    };
    const getRatingText = (rating) => {
        switch (rating) {
            case 1:
                return "Poor - Not suitable for OCR";
            case 2:
                return "Fair - Limited OCR accuracy";
            case 3:
                return "Good - Moderate OCR accuracy";
            case 4:
                return "Very Good - High OCR accuracy";
            case 5:
                return "Excellent - Perfect for OCR";
            default:
                return "No rating";
        }
    };
    const StarRating = ({ rating, onRate, onHover, onLeave, disabled = false, }) => (<div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => !disabled && onRate(star)} onMouseEnter={() => !disabled && onHover(star)} onMouseLeave={() => !disabled && onLeave()} disabled={disabled} className={`transition-colors ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <Star className={`w-7 h-7 ${star <= (hoveredRating || rating)
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300 dark:text-gray-600"}`}/>
        </button>))}
    </div>);
    return (<div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          OCR Quality Rating
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Rate images based on their suitability for OCR processing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Selection */}
        <div className="bg-white dark:bg-glass dark:border-white/10 border border-gray-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Select Image
          </h3>

          {imageFiles.length === 0 ? (<div className="text-center py-8 text-gray-600 dark:text-gray-400">
              <Image className="mx-auto h-12 w-12 opacity-60 mb-3"/>
              <p>No images available</p>
            </div>) : (<div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {imageFiles.map((file, index) => {
                const existingRating = ratings?.find(([docId]) => Number(docId) === index);
                const ratingValue = existingRating
                    ? Number(existingRating[1])
                    : 0;
                return (<button key={`${file.path}-${index}`} onClick={() => loadImage(file, index)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${selectedImage?.path === file.path
                        ? "bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-200"
                        : "border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-300 text-gray-700 dark:text-gray-300"}`}>
                    <div className="flex items-center min-w-0">
                      <Image className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0"/>
                      <span className="truncate">{file.path}</span>
                    </div>
                    {ratingValue > 0 && (<div className="flex items-center ml-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
                        <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                          {ratingValue}
                        </span>
                      </div>)}
                  </button>);
            })}
            </div>)}
        </div>

        {/* Rating Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-glass dark:border-white/10 border border-gray-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Rate OCR Quality
          </h3>

          {!selectedImage ? (<div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400">
              <Star className="mx-auto h-12 w-12 opacity-60 mb-4"/>
              <p>Select an image to rate its OCR quality</p>
            </div>) : (<div className="space-y-6">
              {/* Image Preview */}
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                <img src={imageUrl} alt={selectedImage.path} className="w-full h-auto max-h-96 object-contain"/>
              </div>

              {/* Rating Controls */}
              <div className="bg-gray-50 dark:bg-darkblue/40 rounded-xl p-6">
                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Rate OCR Suitability
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    How suitable is this image for OCR text extraction?
                  </p>

                  <div className="flex justify-center mb-4">
                    <StarRating rating={currentRating} onRate={(rating) => {
                const docIndex = imageFiles.findIndex((f) => f.path === selectedImage.path);
                if (docIndex !== -1) {
                    handleRating(rating, docIndex);
                }
            }} onHover={setHoveredRating} onLeave={() => setHoveredRating(0)} disabled={rateOCRMutation.isPending}/>
                  </div>

                  {rateOCRMutation.isPending && (<div className="flex items-center justify-center mb-4 text-gray-600 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                      Saving rating...
                    </div>)}

                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {getRatingText(hoveredRating || currentRating)}
                  </p>

                  {currentRating > 0 && (<div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        ✓ Rating saved successfully
                      </p>
                    </div>)}
                </div>
              </div>

              {/* Guidelines */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                <h5 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Rating Guidelines
                </h5>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>⭐ Poor: Blurry, low contrast, or distorted text</li>
                  <li>⭐⭐ Fair: Some clarity issues but text partially readable</li>
                  <li>⭐⭐⭐ Good: Clear text with minor issues</li>
                  <li>⭐⭐⭐⭐ Very Good: High quality with excellent clarity</li>
                  <li>⭐⭐⭐⭐⭐ Excellent: Perfect quality, ideal for OCR</li>
                </ul>
              </div>
            </div>)}
        </div>
      </div>
    </div>);
}
