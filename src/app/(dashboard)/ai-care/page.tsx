'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardHero from '@/components/layout/DashboardHero';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { Apple, Dumbbell, HeartPulse, Loader2, AlertTriangle, Sparkles, Clock, RefreshCw } from 'lucide-react';

interface AICareRecord {
  id: string;
  careType: string;
  pregnancyWeek: number | null;
  query: string | null;
  suggestions: string;
  generatedAt: string;
}

export default function AiCarePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'FOOD' | 'EXERCISE' | 'FIRSTAID'>('FOOD');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string>('');
  const [pregnancyWeek, setPregnancyWeek] = useState<number>(20);
  const [error, setError] = useState<string>('');
  const [recentRecords, setRecentRecords] = useState<AICareRecord[]>([]);

  // Fetch previous records
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await fetch(`/api/ai-care?careType=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setRecentRecords(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch records:', error);
      }
    };

    fetchRecords();
  }, [activeTab]);

  const fetchSuggestions = async (careType: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai-care', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careType,
          pregnancyWeek,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuggestions(data.data.suggestions);
        // Refresh records after getting new suggestions
        const recordsRes = await fetch(`/api/ai-care?careType=${careType}`);
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          setRecentRecords(recordsData.data || []);
        }
      } else {
        setError(data.error || 'Failed to generate suggestions');
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setError('Failed to generate suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'FOOD', label: 'Nutrition', icon: Apple, color: 'text-emerald-600', bg: 'bg-emerald-50', description: 'Healthy eating for pregnancy' },
    { id: 'EXERCISE', label: 'Exercise', icon: Dumbbell, color: 'text-blue-600', bg: 'bg-blue-50', description: 'Safe fitness activities' },
    { id: 'FIRSTAID', label: 'First Aid', icon: HeartPulse, color: 'text-rose-600', bg: 'bg-rose-50', description: 'Emergency care guidance' },
  ];

  const formatSuggestions = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmedLine = line.trim();

      // Main headings (##)
      if (trimmedLine.startsWith('##')) {
        const heading = trimmedLine.replace(/^##\s*/, '').replace(/\*\*/g, '');
        return (
          <div key={i} className="mt-8 first:mt-0 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-1 w-8 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-900">{heading}</h2>
            </div>
          </div>
        );
      }

      // Sub headings (###)
      if (trimmedLine.startsWith('###')) {
        const heading = trimmedLine.replace(/^###\s*/, '').replace(/\*\*/g, '');
        return (
          <div key={i} className="mt-6 mb-3">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
              {heading}
            </h3>
          </div>
        );
      }

      // Bold text (**text**)
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        const text = trimmedLine.replace(/\*\*/g, '');
        return (
          <div key={i} className="my-3">
            <p className="font-semibold text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border-l-4 border-teal-500">
              {text}
            </p>
          </div>
        );
      }

      // List items (- or •)
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        const text = trimmedLine.substring(2).replace(/\*\*/g, '');
        const [boldPart, ...rest] = text.split(' - ');

        return (
          <div key={i} className="my-2 ml-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-gray-700 leading-relaxed">
                {boldPart.replace(/\*\*/g, '') && (
                  <span className="font-medium text-gray-900">{boldPart.replace(/\*\*/g, '')}</span>
                )}
                {rest.length > 0 && (
                  <span> - {rest.join(' - ').replace(/\*\*/g, '')}</span>
                )}
              </p>
            </div>
          </div>
        );
      }

      // Regular paragraphs
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const cleanText = trimmedLine.replace(/\*\*/g, '');

        // Check if it's a disclaimer or important note
        if (cleanText.toLowerCase().includes('disclaimer') || cleanText.toLowerCase().includes('important')) {
          return (
            <div key={i} className="my-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 font-medium leading-relaxed">
                  {cleanText}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div key={i} className="my-3">
            <p className="text-gray-700 leading-relaxed">{cleanText}</p>
          </div>
        );
      }

      // Empty lines for spacing
      if (!trimmedLine) {
        return <div key={i} className="h-2" />;
      }

      return null;
    }).filter(Boolean);
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        title="AI-Assisted Care Module"
        subtitle="Get personalized health guidance for nutrition, exercise, and care during your pregnancy"
        pillLabel="AI Guidance"
        pillColorClass="text-[#7C3AED]"
        actions={(
          <Button
            variant="outline"
            className="!bg-white hover:!bg-gray-100 !text-gray-900 font-bold rounded-xl !border !border-gray-200 shadow-sm transition-all cursor-pointer"
            onClick={() => fetchSuggestions(activeTab)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 text-gray-700 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      />

      {/* Disclaimer Card */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-900 font-semibold">Important Disclaimer</p>
          <p className="text-sm text-amber-800/90 mt-0.5 leading-relaxed">
            This information is for general awareness only and should not replace professional medical advice.
            Always consult your healthcare provider or assigned midwife for personalized clinical guidance.
          </p>
        </div>
      </div>

      {/* Pregnancy Week Selector */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <label className="text-sm font-semibold text-gray-900 whitespace-nowrap">
              Select Pregnancy Stage:
            </label>
            <div className="flex-1 flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="42"
                value={pregnancyWeek}
                onChange={(e) => setPregnancyWeek(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
                style={{
                  background: `linear-gradient(to right, #14B8A6 0%, #14B8A6 ${((pregnancyWeek - 1) / 41) * 100}%, #E5E7EB ${((pregnancyWeek - 1) / 41) * 100}%, #E5E7EB 100%)`
                }}
              />
            </div>
            <div className="min-w-fit">
              <span className="text-2xl font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-lg">
                Week {pregnancyWeek}
              </span>
              <div className="text-xs text-gray-500 mt-1 text-center">
                {pregnancyWeek <= 12 ? '1st Trimester' : pregnancyWeek <= 26 ? '2nd Trimester' : '3rd Trimester'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as 'FOOD' | 'EXERCISE' | 'FIRSTAID');
                setSuggestions('');
                setError('');
              }}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-teal-400' : 'text-gray-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                {activeTab === 'FOOD' && 'Personalized Nutrition Guidance'}
                {activeTab === 'EXERCISE' && 'Safe Trimester Exercise Recommendations'}
                {activeTab === 'FIRSTAID' && 'Essential First Aid & Care Information'}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {!suggestions && !loading && !error && (
                <div className="text-center py-12">
                  <div className="mb-4 inline-flex p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    {activeTab === 'FOOD' && <Apple className="h-12 w-12 text-emerald-600" />}
                    {activeTab === 'EXERCISE' && <Dumbbell className="h-12 w-12 text-blue-600" />}
                    {activeTab === 'FIRSTAID' && <HeartPulse className="h-12 w-12 text-rose-600" />}
                  </div>
                  <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
                    {activeTab === 'FOOD' && `Get tailored nutritional guidance and meal recommendations for Week ${pregnancyWeek} of your pregnancy.`}
                    {activeTab === 'EXERCISE' && `Discover safe, low-impact exercise routines appropriate for Week ${pregnancyWeek}.`}
                    {activeTab === 'FIRSTAID' && 'Review essential first-aid guidelines for common pregnancy discomforts and warning signs.'}
                  </p>
                  <Button
                    onClick={() => fetchSuggestions(activeTab)}
                    className="rounded-xl px-6 py-2.5 font-semibold"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {tabs.find((t) => t.id === activeTab)?.label} Advice
                  </Button>
                </div>
              )}

              {loading && (
                <div className="text-center py-14">
                  <Loader2 className="h-10 w-10 text-teal-600 mx-auto animate-spin mb-4" />
                  <p className="text-sm font-medium text-gray-700">Generating personalized AI health guidance...</p>
                  <p className="text-xs text-gray-400 mt-1">Analyzing pregnancy week and clinical recommendations</p>
                </div>
              )}

              {suggestions && !loading && (
                <div className="space-y-4">
                  {/* Header Info */}
                  <div className="bg-gradient-to-r from-teal-50 via-blue-50 to-purple-50 rounded-xl p-6 border border-teal-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">AI-Generated Recommendations</h3>
                        <p className="text-sm text-gray-600">
                          Personalized for Week {pregnancyWeek} • {tabs.find(t => t.id === activeTab)?.label} Guidance • Generated on {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Suggestions Content */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="prose prose-gray max-w-none">
                      {formatSuggestions(suggestions)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <Button
                      variant="outline"
                      onClick={() => fetchSuggestions(activeTab)}
                      className="flex items-center gap-2 hover:bg-teal-50 hover:border-teal-300 rounded-xl font-semibold"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Suggestions
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSuggestions('');
                        setError('');
                      }}
                      className="hover:bg-gray-50 rounded-xl font-semibold"
                    >
                      Clear
                    </Button>
                    <div className="flex-1" />
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Generated just now</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Recent Records */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                Recent {tabs.find(t => t.id === activeTab)?.label} History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentRecords.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentRecords.slice(0, 5).map((record) => (
                    <div
                      key={record.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => setSuggestions(record.suggestions)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="default" className="text-xs">
                          Week {record.pregnancyWeek || 'N/A'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(record.generatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {record.suggestions.substring(0, 100)}...
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    No recent {tabs.find(t => t.id === activeTab)?.label.toLowerCase()} records
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}