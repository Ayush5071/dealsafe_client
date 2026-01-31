"use client";
import { useState, useEffect } from "react";

export default function HILStatusChecker({ hilId, analysisId, onComplete, onError }) {
  const [status, setStatus] = useState('pending_expert_review');
  const [checkCount, setCheckCount] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('5-15 minutes');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!analysisId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/hil-review', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysis_id: analysisId })
        });

        if (!res.ok) throw new Error('Failed to check status');
        
        const data = await res.json();
        setStatus(data.status);
        setCheckCount(prev => prev + 1);

        if (data.status === 'approved') {
          onComplete?.(data.analysis);
        } else if (data.status === 'needs_revision') {
          setError('Analysis was rejected and is being re-analyzed. Please wait...');
        } else if (data.status === 'rejected') {
          setError('Analysis was rejected by expert. Please try uploading again.');
          onError?.('Analysis rejected by expert');
        }
      } catch (err) {
        console.error('Status check error:', err);
        setError(err.message);
      }
    };

    // Check immediately, then every 10 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 10000);

    // Stop checking after 30 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setError('Review is taking longer than expected. Please check back later.');
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [analysisId, onComplete, onError]);

  const getStatusMessage = () => {
    switch (status) {
      case 'pending_expert_review':
        return 'Waiting for expert review...';
      case 'needs_revision':
        return 'Analysis being improved based on expert feedback...';
      case 'approved':
        return 'Approved! Loading results...';
      case 'rejected':
        return 'Analysis was rejected by expert';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending_expert_review':
        return 'text-yellow-400';
      case 'needs_revision':
        return 'text-orange-400';
      case 'approved':
        return 'text-green-400';
      case 'rejected':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 text-center">
      <div className="mb-6">
        <div className="relative mx-auto w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-zinc-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Human-in-the-Loop Review</h3>
        <p className={`text-lg font-medium mb-2 ${getStatusColor()}`}>
          {getStatusMessage()}
        </p>
      </div>

      <div className="space-y-4 text-sm">
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <p className="text-zinc-300 mb-2">
            <strong>What's happening:</strong>
          </p>
          <p className="text-zinc-400">
            Your analysis is being reviewed by legal experts to ensure accuracy and completeness. 
            This helps us continuously improve the AI system.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <p className="text-zinc-300 text-xs mb-1">Status Checks</p>
            <p className="text-white font-semibold">{checkCount}</p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <p className="text-zinc-300 text-xs mb-1">Estimated Time</p>
            <p className="text-white font-semibold">{estimatedTime}</p>
          </div>
        </div>

        {hilId && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <p className="text-blue-200 text-xs">
              <strong>Tracking ID:</strong> {hilId.toString().substring(0, 8)}...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <p className="text-red-200 text-xs">{error}</p>
          </div>
        )}

        <div className="text-xs text-zinc-500">
          This page will automatically update when the review is complete.
          You can safely close this tab and return later.
        </div>
      </div>
    </div>
  );
}