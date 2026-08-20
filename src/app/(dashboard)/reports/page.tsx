'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '@/components/ui';

import { FileText, Download, Calendar, Users, Syringe, BarChart3, Plus, Trash2, AlertCircle } from 'lucide-react';
import DashboardHero from '@/components/layout/DashboardHero';


export default function ReportsPage() {
  const { data: session } = useSession();
  const [reportType, setReportType] = useState('mothers');
  const [dateRange, setDateRange] = useState('month');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [reportMotherId, setReportMotherId] = useState('');

  // Custom Date Picker States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<{
    id: string;
    name: string;
    createdAt: string;
  }[]>([]);
  const [newDocTypeName, setNewDocTypeName] = useState('');
  const [docTypeLoading, setDocTypeLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Patient Documents States
  const [mothers, setMothers] = useState<{id: string, user: {name: string, email: string}}[]>([]);
  const [selectedMotherId, setSelectedMotherId] = useState('');
  type DocumentItem = {
    id: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
    documentType: { name: string };
  };
  const [motherDocuments, setMotherDocuments] = useState<DocumentItem[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMothers = async () => {
    try {
      const res = await fetch('/api/mothers?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        setMothers(data.data || []);
      }
    } catch (_err) {
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
    } catch (_err) {
      setError('Failed to load document types');
    }
  };

  useEffect(() => {
    (async () => {
      await fetchMothers();
      if (session?.user?.role === 'ADMIN' || session?.user?.role === 'MIDWIFE') {
        await fetchDocumentTypes();
      }
    })();
  }, [session]);

  const handleCreateDocumentType = async () => {
    if (!newDocTypeName.trim()) {
      setError('Document type name is required');
      return;
    }

    setDocTypeLoading(true);
    setError('');

    try {
      const res = await fetch('/api/documents/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDocTypeName.trim() })
      });

      if (res.ok || res.status === 201) {
        setNewDocTypeName('');
        await fetchDocumentTypes();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create document type');
      }
    } catch (_err) {
      setError('Error creating document type');
    } finally {
      setDocTypeLoading(false);
    }
  };

  const handleDeleteDocumentType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document type?')) return;

    try {
      const res = await fetch(`/api/documents/types?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await fetchDocumentTypes();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete document type');
      }
    } catch (_err) {
      setError('Error deleting document type');
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
    } catch (_err) {
      console.error('Failed to load documents');
    }
  };

  useEffect(() => {
    if (selectedMotherId) {
      (async () => {
        await fetchMotherDocuments(selectedMotherId);
      })();
    } else {
      Promise.resolve().then(() => setMotherDocuments([]));
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
        const fileInput = document.getElementById('admin-file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        await fetchMotherDocuments(selectedMotherId);
        alert('Document uploaded successfully!');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to upload document.');
      }
    } catch (_err) {
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
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete document.');
      }
    } catch (_err) {
      setError('An error occurred while deleting.');
    } finally {
      setDeletingId(null);
    }
  };

  const reportTypes = [
    { value: 'mothers', label: 'Mothers Report', icon: Users },
    { value: 'visits', label: 'Visits Report', icon: Calendar },
    { value: 'vaccinations', label: 'Vaccinations Report', icon: Syringe },
    { value: 'summary', label: 'Summary Report', icon: BarChart3 },
  ];

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const filenameFromResponse = (res: Response, fallback: string) => {
    const header = res.headers.get('Content-Disposition') || '';
    const match = header.match(/filename="([^"]+)"/);
    return match?.[1] || fallback;
  };

  const generateReport = async () => {
    if (dateRange === 'custom' && (!startDate || !endDate)) {
      alert('Please select both a start date and an end date.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const rangeQuery =
        dateRange === 'custom'
          ? `range=custom&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
          : `range=${encodeURIComponent(dateRange)}`;

      if (reportType === 'summary') {
        const motherQuery = reportMotherId ? `&motherId=${encodeURIComponent(reportMotherId)}` : '';
        const res = await fetch(`/api/reports/summary?format=${exportFormat}&${rangeQuery}${motherQuery}`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(`Failed to generate report: ${data.error || 'Unknown error'}`);
          return;
        }

        const blob = await res.blob();
        const fallback = `mothers-summary-report-${today}.${exportFormat === 'xlsx' ? 'xlsx' : 'pdf'}`;
        downloadBlob(blob, filenameFromResponse(res, fallback));
        return;
      }

      const role = session?.user?.role === 'MIDWIFE' ? 'midwife' : 'admin';
      const typedEndpoint =
        role === 'midwife' && reportType === 'vaccinations'
          ? '/api/reports/generate'
          : `/api/reports/${role}/${reportType}`;

      const res = await fetch(typedEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          range: dateRange,
          ...(dateRange === 'custom' && { startDate, endDate }),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to generate report: ${data.error || 'Unknown error'}`);
        return;
      }

      const blob = await res.blob();
      downloadBlob(blob, filenameFromResponse(res, `${reportType}-report-${today}.pdf`));
    } catch (err) {
      console.error('Report generation error:', err);
      alert('An error occurred while generating your report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Reports"
        subtitle="Generate and download system reports"
        pillLabel="Reports"
      />

      {/* Document Type Management - ADMIN Only */}
      {session?.user?.role === 'ADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle>Document Type Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Create New Document Type */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900">
                Add New Document Type
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDocTypeName}
                  onChange={(e) => setNewDocTypeName(e.target.value)}
                  placeholder="e.g., H15 Card, Blood Report, Anomaly Scan"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateDocumentType()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Button
                  onClick={handleCreateDocumentType}
                  isLoading={docTypeLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              </div>
            </div>

            {/* Document Types List */}
            {documentTypes.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-900">
                  Existing Document Types
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {documentTypes.map((docType: { id: string; name: string; _count?: { documents: number } }) => (
                    <div
                      key={docType.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{docType.name}</p>
                        {(docType._count?.documents ?? 0) > 0 && (
                          <p className="text-xs text-gray-500">
                            {docType._count?.documents} document(s)
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteDocumentType(docType.id)}
                        disabled={(docType._count?.documents ?? 0) > 0}
                        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={(docType._count?.documents ?? 0) > 0 ? 'Cannot delete - has documents' : 'Delete type'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

            {reportType === 'summary' && (
              <>
                <Select
                  label="Mother"
                  value={reportMotherId}
                  onChange={(e) => setReportMotherId(e.target.value)}
                  options={[
                    { value: '', label: 'All mothers' },
                    ...mothers.map((m) => ({
                      value: m.id,
                      label: m.user?.name || m.id,
                    })),
                  ]}
                />
                <Select
                  label="Export Format"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'xlsx' | 'pdf')}
                  options={[
                    { value: 'xlsx', label: 'Excel (.xlsx)' },
                    { value: 'pdf', label: 'PDF (.pdf)' },
                  ]}
                />
              </>
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
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors text-gray-900 ${reportType === report.value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Icon className={`h-8 w-8 mb-2 ${reportType === report.value ? 'text-teal-600' : 'text-gray-400'
                      }`} />
                    <h4 className="font-medium text-gray-900">{report.label}</h4>
                    <p className="text-sm text-gray-600">
                      {report.value === 'mothers' && 'List of registered mothers with details'}
                      {report.value === 'visits' && 'Visit history and statistics'}
                      {report.value === 'vaccinations' && 'Vaccination coverage report'}
                      {report.value === 'summary' && 'Per-mother Excel/PDF with visits, vaccines, Thriposha, and records'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Mother Documents Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Upload Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Upload Document</h3>
              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Select Patient</label>
                  <select
                    className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                    className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                    id="admin-file-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 border border-gray-300 rounded-lg p-1"
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
              <h3 className="text-lg font-medium text-gray-900">Mother&apos;s Document</h3>
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