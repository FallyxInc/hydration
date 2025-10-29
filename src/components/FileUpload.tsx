'use client';

import { useState, useEffect } from 'react';

interface FileUploadProps {}

export default function FileUpload({}: FileUploadProps) {
  const [carePlanFiles, setCarePlanFiles] = useState<File[]>([]);
  const [hydrationDataFiles, setHydrationDataFiles] = useState<File[]>([]);
  const [selectedRetirementHome, setSelectedRetirementHome] = useState('');
  const [retirementHomes, setRetirementHomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [message, setMessage] = useState('');

  // Fetch retirement homes from the API
  useEffect(() => {
    const fetchRetirementHomes = async () => {
      try {
        setLoadingHomes(true);
        console.log('🏠 [FILE UPLOAD] Fetching retirement homes...');
        
        const response = await fetch('/api/retirement-homes');
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ [FILE UPLOAD] Retirement homes fetched:', data.retirementHomes);
          setRetirementHomes(data.retirementHomes);
        } else {
          console.error('❌ [FILE UPLOAD] Error fetching retirement homes:', data.error);
          setMessage(`Error loading retirement homes: ${data.error}`);
        }
      } catch (error) {
        console.error('❌ [FILE UPLOAD] Network error fetching retirement homes:', error);
        setMessage(`Error loading retirement homes: ${error}`);
      } finally {
        setLoadingHomes(false);
      }
    };

    fetchRetirementHomes();
  }, []);

  const handleCarePlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setCarePlanFiles(files);
    }
  };

  const handleHydrationDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setHydrationDataFiles(files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    console.log('🚀 [FILE UPLOAD] Starting file upload process...');
    console.log('📁 [FILE UPLOAD] Care plan files:', carePlanFiles.map(f => f.name));
    console.log('💧 [FILE UPLOAD] Hydration data files:', hydrationDataFiles.map(f => f.name));
    console.log('🏠 [FILE UPLOAD] Retirement home:', selectedRetirementHome);

    if (carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedRetirementHome) {
      setMessage('Please select at least one care plan file, one hydration data file, and a retirement home');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      
      // Append all care plan files
      carePlanFiles.forEach((file, index) => {
        formData.append(`carePlan_${index}`, file);
        console.log(`📄 [FILE UPLOAD] Added care plan file ${index}: ${file.name} (${file.size} bytes)`);
      });
      
      // Append all hydration data files
      hydrationDataFiles.forEach((file, index) => {
        formData.append(`hydrationData_${index}`, file);
        console.log(`💧 [FILE UPLOAD] Added hydration data file ${index}: ${file.name} (${file.size} bytes)`);
      });
      
      formData.append('retirementHome', selectedRetirementHome);
      formData.append('carePlanCount', carePlanFiles.length.toString());
      formData.append('hydrationDataCount', hydrationDataFiles.length.toString());

      console.log('📤 [FILE UPLOAD] Sending request to /api/process-files...');

      const response = await fetch('/api/process-files', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      console.log('📥 [FILE UPLOAD] Response received:', { status: response.status, ok: response.ok });
      console.log('📊 [FILE UPLOAD] Response data:', result);

      if (response.ok) {
        console.log('✅ [FILE UPLOAD] Files processed successfully!');
        setMessage('Files processed successfully!');
        setCarePlanFiles([]);
        setHydrationDataFiles([]);
        setSelectedRetirementHome('');
        // Reset file inputs
        const carePlanInput = document.getElementById('carePlan') as HTMLInputElement;
        const hydrationDataInput = document.getElementById('hydrationData') as HTMLInputElement;
        if (carePlanInput) carePlanInput.value = '';
        if (hydrationDataInput) hydrationDataInput.value = '';
      } else {
        console.error('❌ [FILE UPLOAD] Error processing files:', result.error);
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('💥 [FILE UPLOAD] Network or processing error:', error);
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
      console.log('🏁 [FILE UPLOAD] Upload process completed');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base leading-6 font-medium text-gray-900 mb-6">
          Upload Hydration Files
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Care Plan File Upload */}
          <div>
            <label htmlFor="carePlan" className="block text-sm font-medium text-gray-700">
              Care Plan PDF
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="carePlan"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="carePlan"
                      name="carePlan"
                      type="file"
                      accept=".pdf"
                      multiple
                      className="sr-only"
                      onChange={handleCarePlanChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {carePlanFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-green-600 font-medium">Selected {carePlanFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {carePlanFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Hydration Data File Upload */}
          <div>
            <label htmlFor="hydrationData" className="block text-sm font-medium text-gray-700">
              Hydration Data PDF
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="hydrationData"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="hydrationData"
                      name="hydrationData"
                      type="file"
                      accept=".pdf"
                      multiple
                      className="sr-only"
                      onChange={handleHydrationDataChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {hydrationDataFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-green-600 font-medium">Selected {hydrationDataFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {hydrationDataFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Retirement Home Selection */}
          <div>
            <label htmlFor="retirementHome" className="block text-sm font-medium text-gray-700">
              Select Retirement Home
            </label>
            <select
              id="retirementHome"
              name="retirementHome"
              value={selectedRetirementHome}
              onChange={(e) => setSelectedRetirementHome(e.target.value)}
              disabled={loadingHomes}
              className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ 
                '--tw-ring-color': '#0cc7ed',
                '--tw-border-color': '#0cc7ed'
              } as React.CSSProperties}
              onFocus={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#0cc7ed';
                (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
              }}
              onBlur={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#d1d5db';
                (e.target as HTMLSelectElement).style.boxShadow = 'none';
              }}
            >
              <option value="">
                {loadingHomes ? 'Loading retirement homes...' : 'Select a retirement home...'}
              </option>
              {retirementHomes.map((home) => (
                <option key={home} value={home}>
                  {home}
                </option>
              ))}
            </select>
            {retirementHomes.length === 0 && !loadingHomes && (
              <p className="mt-1 text-sm text-amber-600">
                No retirement homes found. Please create users with retirement homes first.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || loadingHomes || carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedRetirementHome}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: '#0cc7ed' }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#0aa8c7';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#0cc7ed';
                }
              }}
            >
              {loading ? 'Processing...' : 'Process Files'}
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`text-sm ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
