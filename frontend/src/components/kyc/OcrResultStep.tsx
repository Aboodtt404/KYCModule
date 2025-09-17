import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit3, CheckCircle, User } from "lucide-react";

interface OcrResultStepProps {
  ocrData: Record<string, string>;
  faceImage?: string;
  onNext: () => void;
  onEdit: () => void;
}

export function OcrResultStep({ ocrData, faceImage, onNext, onEdit }: OcrResultStepProps) {
  return (
    <GlassCard>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        key="ocr-result"
        className="flex flex-col gap-4 items-center justify-center"
      >
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-bold">Review Extracted Information</h2>
          <p className="text-muted-foreground">
            Please review the details extracted from your document. If everything looks correct, you can continue. If you need to make changes, you'll need to verify your identity first.
          </p>
        </div>

        {/* Face Preview */}
        {faceImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-200 dark:border-emerald-800 shadow-lg">
                <img 
                  src={`data:image/jpeg;base64,${faceImage}`} 
                  alt="Face from ID" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-4">
          {(() => {
            // Define the fields we want to display in order
            const fieldsToShow = [
              { key: 'full_name', label: 'Full Name', fallbackKeys: ['first_name', 'second_name', 'name'] },
              { key: 'national_id', label: 'National ID', fallbackKeys: ['id', 'national_id_number'] },
              { key: 'address', label: 'Address', fallbackKeys: ['location', 'residence'] },
              { key: 'birth_date', label: 'Birth Date', fallbackKeys: ['date_of_birth', 'birthday'] },
              { key: 'gender', label: 'Gender', fallbackKeys: ['sex'] },
              { key: 'governorate', label: 'Governorate', fallbackKeys: ['state', 'province'] }
            ];
            
            const getFieldValue = (fieldKey: string, fallbackKeys: string[] = []) => {
              // First try the main key
              let value = ocrData[fieldKey];
              if (value) return value;
              
              // Then try fallback keys
              for (const fallbackKey of fallbackKeys) {
                value = ocrData[fallbackKey];
                if (value) return value;
              }
              
              // If still no value, try to construct full_name from first_name and second_name
              if (fieldKey === 'full_name') {
                const firstName = ocrData['first_name'] || ocrData['firstName'];
                const secondName = ocrData['second_name'] || ocrData['secondName'];
                if (firstName && secondName) {
                  return `${firstName} ${secondName}`;
                }
                if (firstName) return firstName;
                if (secondName) return secondName;
              }
              
              return '';
            };
            
            return fieldsToShow.map(({ key, label, fallbackKeys }) => {
              const value = getFieldValue(key, fallbackKeys);
              const displayValue = typeof value === 'string' ? value : (value ? String(value) : '');
              
              return (
                <div className="grid w-full items-center gap-1.5" key={key}>
                  <Label htmlFor={key} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                  </Label>
                  <Input 
                    id={key} 
                    value={displayValue} 
                    disabled 
                    className="text-foreground bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600" 
                  />
                </div>
              );
            });
          })()}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-md">
          <Button 
            onClick={onNext} 
            className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Continue</span>
            </div>
          </Button>
          
          <Button 
            onClick={onEdit}
            variant="outline"
            className="flex-1 h-12 text-lg font-semibold border-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
          >
            <div className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>Edit Details</span>
            </div>
          </Button>
        </div>
      </motion.div>
    </GlassCard>
  );
}
