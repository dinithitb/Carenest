'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '@/components/ui';
import { FileText, Download, Calendar, Users, Syringe, BarChart3, Plus, Trash2, AlertCircle, Upload } from 'lucide-react';

export default function MidwifeReportsPage() {
  const { data: session } = useSession();
  const [reportType, setReportType] = useState('mothers');
  const [dateRange, setDateRange] = useState('month');

  // Custom Date Picker States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<{
    id: string;
    name: string;
    createdAt: string;
  }[]>([]);
  const [error, setError] = useState<string>('');

  // Patient Documents States
  const [mothers, setMothers] = useState<{id: string, user: {name: string, email: string}}[]>([]);
  const [selectedMotherId, setSelectedMotherId] = useState('');
  const [motherDocuments, setMotherDocuments] = useState<any[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Recent Documents States
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchMothers();
    fetchDocumentTypes();
    fetchRecentDocuments();
  }, [session]);

  const fetchMothers = async () => {
    try {
      const res = await fetch('/api/mothers?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        setMothers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load mothers');
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const res = await fetch('/api/documents/types');
      if (res.ok) {
        const data = await res.json();
        setDocumentTypes(data.data || []);
      }
    } catch (err) {
      setError('Failed to load document types');
    }
  };

  const fetchRecentDocuments = async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch('/api/documents/recent?limit=10');
      if (res.ok) {
        const data = await res.json();
        setRecentDocuments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load recent documents');
    } finally {
      setLoadingRecent(false);
    }
  };

  // Patient Documents Handlers
  const fetchMotherDocuments = async (motherId: string) => {
    try {
      const res = await fetch(`/api/documents/${motherId}`);
      if (res.ok) {
        const data = await res.json();
        setMotherDocuments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load documents');
    }
  };

  useEffect(() => {
    if (selectedMotherId) {
      fetchMotherDocuments(selectedMotherId);
    } else {
      setMotherDocuments([]);
    }
  }, [selectedMotherId]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadType || !selectedMotherId) {
      setError('Please select a patient, file, and document type.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentTypeId', uploadType);
      formData.append('motherId', selectedMotherId);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadFile(null);
        setUploadType('');
        const fileInput = document.getElementById('midwife-file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        await fetchMotherDocuments(selectedMotherId);
        await fetchRecentDocuments(); // Refresh recent documents
        alert('Document uploaded successfully!');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to upload document.');
      }
    } catch (err) {
      setError('An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePatientDocument = async (docId: string) => {
    if (!selectedMotherId) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeletingId(docId);
    setError('');

    try {
      const res = await fetch(`/api/documents/${selectedMotherId}?documentId=${docId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchMotherDocuments(selectedMotherId);
        await fetchRecentDocuments(); // Refresh recent documents
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete document.');
      }
    } catch (err) {
      setError('An error occurred while deleting.');
    } finally {
      setDeletingId(null);
    }
  };

  const reportTypes = [
    { value: 'mothers', label: 'My Mothers Report', icon: Users },
    { value: 'visits', label: 'My Visits Report', icon: Calendar },
    { value: 'vaccinations', label: 'Vaccinations Report', icon: Syringe },
    { value: 'summary', label: 'Activity Summary', icon: BarChart3 },
  ];

  const generateReport = async () => {
    // Basic frontend validation for custom range selection
    if (dateRange === 'custom' && (!startDate || !endDate)) {
      alert('Please select both a start date and an end date.');
      return;
    }

    setLoading(true);

    try {
      // Use the simple sample report generator
      const apiEndpoint = `/api/reports/generate`;
      
      const requestBody = {
        reportType: reportType,
        range: dateRange,
        ...(dateRange === 'custom' && { startDate, endDate }),
      };

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        alert('Report downloaded successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to generate report: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Report generation error:', err);
      alert('An error occurred while generating your report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Documents</h1>
        <p className="text-gray-500">Generate reports and manage patient documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Configuration */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Report Type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              options={reportTypes.map(r => ({ value: r.value, label: r.label }))}
            />
            <Select
              label="Date Range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              options={[
                { value: 'week', label: 'Last 7 Days' },
                { value: 'month', label: 'Last 30 Days' },
                { value: 'quarter', label: 'Last 3 Months' },
                { value: 'year', label: 'Last Year' },
                { value: 'all', label: 'All Time' },
                { value: 'custom', label: 'Custom Range 📅' },
              ]}
            />

            {/* Custom Date Pickers render conditionally with smooth CSS transitions */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900"
                  />
                </div>
              </div>
            )}

            <Button className="w-full mt-2" onClick={generateReport} isLoading={loading}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>

        {/* Report Types Grid Preview Selector */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Available Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {reportTypes.map((report) => {
                const Icon = report.icon;
                return (
                  <div
                    key={report.value}
                    onClick={() => setReportType(report.value)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${reportType === report.value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Icon className={`h-8 w-8 mb-2 ${reportType === report.value ? 'text-teal-600' : 'text-gray-400'
                      }`} />
                    <h4 className="font-medium">{report.label}</h4>
                    <p className="text-sm text-gray-500">
                      {report.value === 'mothers' && 'List of mothers assigned to you'}
                      {report.value === 'visits' && 'Your visit schedule and history'}
                      {report.value === 'vaccinations' && 'Vaccination records for your mothers'}
                      {report.value === 'summary' && 'Your professional activity summary'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Uploaded Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-teal-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading recent documents...</p>
            </div>
          ) : recentDocuments.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No documents uploaded yet</p>
              <p className="text-sm mt-1">Recently uploaded documents will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-teal-50 rounded-lg shrink-0">
                      <FileText className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate" title={doc.fileName}>
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                        <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-xs">
                          {doc.documentType.name}
                        </span>
                        <span>•</span>
                        <span>{doc.mother?.user?.name || 'Unknown'}</span>
                        <span>•</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(doc.fileUrl, '_blank')}
                      title="View document"
                    >
                      View
                    </Button>
                    <a
                      href={doc.fileUrl}
                      download={doc.fileName}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                      title="Download document"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Mother Documents Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Upload Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Upload Document</h3>
              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Select Patient</label>
                  <select
                    className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={selectedMotherId}
                    onChange={(e) => setSelectedMotherId(e.target.value)}
                  >
                    <option value="">-- Select Patient --</option>
                    {mothers.map(m => (
                      <option key={m.id} value={m.id}>{m.user?.name} ({m.user?.email})</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Document Type</label>
                  <select
                    className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Select Type --</option>
                    {documentTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">File (PDF, JPG, PNG)</label>
                  <input
                    id="midwife-file-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 border border-gray-300 rounded-lg p-1"
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={uploading || !uploadFile || !uploadType || !selectedMotherId}
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
              </form>
            </div>

            {/* Right: Existing Documents */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Mother&apos;s Document</h3>
              {!selectedMotherId ? (
                <div className="p-8 text-center border-2 border-dashed rounded-lg text-gray-500">
                  Select a patient to view their documents.
                </div>
              ) : motherDocuments.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-lg text-gray-500">
                  No documents found for this patient.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {motherDocuments.map(doc => (
                    <div key={doc.id} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded">
                            {doc.documentType.name}
                          </span>
                          <p className="font-medium text-gray-900 mt-1 truncate max-w-[200px]" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(doc.fileUrl, '_blank')}
                            title="View document in new tab"
                          >
                            View
                          </Button>
                          <a
                            href={doc.fileUrl}
                            download={doc.fileName}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeletePatientDocument(doc.id)}
                            disabled={deletingId === doc.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200"
                          >
                            {deletingId === doc.id ? '...' : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
