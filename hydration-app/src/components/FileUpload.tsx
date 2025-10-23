'use client';

import { useState } from 'react';

interface FileUploadProps {}

export default function FileUpload({}: FileUploadProps) {
  const [carePlanFile, setCarePlanFile] = useState<File | null>(null);
  const [hydrationDataFile, setHydrationDataFile] = useState<File | null>(null);
  const [selectedRetirementHome, setSelectedRetirementHome] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCarePlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCarePlanFile(file);
    }
  };

  const handleHydrationDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHydrationDataFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!carePlanFile || !hydrationDataFile || !selectedRetirementHome) {
      setMessage('Please select both files and a retirement home');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('carePlan', carePlanFile);
      formData.append('hydrationData', hydrationDataFile);
      formData.append('retirementHome', selectedRetirementHome);

      const response = await fetch('/api/process-files', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Files processed successfully!');
        setCarePlanFile(null);
        setHydrationDataFile(null);
        setSelectedRetirementHome('');
        // Reset file inputs
        const carePlanInput = document.getElementById('carePlan') as HTMLInputElement;
        const hydrationDataInput = document.getElementById('hydrationData') as HTMLInputElement;
        if (carePlanInput) carePlanInput.value = '';
        if (hydrationDataInput) hydrationDataInput.value = '';
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
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
                    className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="carePlan"
                      name="carePlan"
                      type="file"
                      accept=".pdf"
                      className="sr-only"
                      onChange={handleCarePlanChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {carePlanFile && (
              <p className="mt-2 text-sm text-green-600">Selected: {carePlanFile.name}</p>
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
                    className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="hydrationData"
                      name="hydrationData"
                      type="file"
                      accept=".pdf"
                      className="sr-only"
                      onChange={handleHydrationDataChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {hydrationDataFile && (
              <p className="mt-2 text-sm text-green-600">Selected: {hydrationDataFile.name}</p>
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
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">Select a retirement home...</option>
              <option value="Sunset Manor">Sunset Manor</option>
              <option value="Golden Years">Golden Years</option>
              <option value="Maple Gardens">Maple Gardens</option>
              <option value="Cedar Grove">Cedar Grove</option>
              <option value="Hickory Heights">Hickory Heights</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !carePlanFile || !hydrationDataFile || !selectedRetirementHome}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
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
