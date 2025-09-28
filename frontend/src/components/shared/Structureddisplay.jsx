import React from 'react';
import { User, Hash, Calendar, Globe, FileText, Clock } from 'lucide-react';
export default function StructuredDataDisplay({ data }) {
    const getDocumentTitle = () => {
        return data.documentType === 'national-id' ? 'National ID Information' : 'Passport Information';
    };
    const getDocumentIcon = () => {
        return data.documentType === 'national-id' ? (<Hash className="w-5 h-5 text-blue-600"/>) : (<FileText className="w-5 h-5 text-blue-600"/>);
    };
    const formatDate = (dateStr) => {
        if (!dateStr)
            return 'Not detected';
        // Try to format the date if it's in a recognizable format
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString();
            }
        }
        catch (e) {
            // If parsing fails, return the original string
        }
        return dateStr;
    };
    const dataFields = [
        {
            label: 'Full Name',
            value: data.name || 'Not detected',
            icon: <User className="w-4 h-4 text-gray-500"/>,
            show: true,
        },
        {
            label: 'ID Number',
            value: data.idNumber || 'Not detected',
            icon: <Hash className="w-4 h-4 text-gray-500"/>,
            show: data.documentType === 'national-id',
        },
        {
            label: 'Passport Number',
            value: data.passportNumber || 'Not detected',
            icon: <FileText className="w-4 h-4 text-gray-500"/>,
            show: data.documentType === 'passport',
        },
        {
            label: 'Date of Birth',
            value: formatDate(data.dateOfBirth),
            icon: <Calendar className="w-4 h-4 text-gray-500"/>,
            show: true,
        },
        {
            label: 'Nationality',
            value: data.nationality || 'Not detected',
            icon: <Globe className="w-4 h-4 text-gray-500"/>,
            show: true,
        },
        {
            label: 'Expiry Date',
            value: formatDate(data.expiryDate),
            icon: <Clock className="w-4 h-4 text-gray-500"/>,
            show: data.documentType === 'passport',
        },
    ];
    const visibleFields = dataFields.filter(field => field.show);
    const detectedFields = visibleFields.filter(field => field.value !== 'Not detected');
    const detectionRate = Math.round((detectedFields.length / visibleFields.length) * 100);
    return (<div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getDocumentIcon()}
          <h4 className="font-semibold text-gray-900">{getDocumentTitle()}</h4>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${detectionRate >= 80
            ? 'bg-green-100 text-green-800'
            : detectionRate >= 60
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'}`}>
            {detectionRate}% detected
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map((field, index) => (<div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="mt-0.5">
              {field.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">{field.label}</p>
              <p className={`text-sm mt-1 break-words ${field.value === 'Not detected'
                ? 'text-gray-400 italic'
                : 'text-gray-900 font-medium'}`}>
                {field.value}
              </p>
            </div>
          </div>))}
      </div>

      {detectionRate < 100 && (<div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Some fields could not be automatically detected. 
            This may be due to image quality, document condition, or text orientation. 
            Please verify the extracted information against your original document.
          </p>
        </div>)}
    </div>);
}
