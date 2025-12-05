import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUploadStore } from '@/stores/uploadStore';

// Generate unique device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem('upload-device-id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('upload-device-id', deviceId);
  }
  return deviceId;
};

export function useRealtimeUploadSync() {
  const deviceId = useRef(getDeviceId());
  const { session, updateProgress, setStatus } = useUploadStore();

  // Broadcast local changes to database
  useEffect(() => {
    if (!session || session.status === 'idle' || session.status === 'completed') {
      return;
    }

    const syncToDb = async () => {
      const progress = session.uploadProgress;
      
      try {
        await supabase.from('upload_sessions').upsert({
          session_id: session.id,
          status: session.status,
          total_files: progress?.total || 0,
          processed_files: progress?.completed || 0,
          successful_files: progress?.successful || 0,
          failed_files: progress?.failed || 0,
          skipped_files: progress?.skipped || 0,
          current_file: progress?.current || null,
          device_id: deviceId.current,
        }, {
          onConflict: 'session_id'
        });
      } catch (err) {
        console.error('Error syncing upload progress:', err);
      }
    };

    syncToDb();
  }, [session?.id, session?.status, session?.uploadProgress]);

  // Listen for changes from other devices
  useEffect(() => {
    const channel = supabase
      .channel('upload-sessions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'upload_sessions'
        },
        (payload) => {
          const data = payload.new as any;
          
          // Ignore our own updates
          if (data.device_id === deviceId.current) {
            return;
          }

          // Update local state with remote changes
          if (data.status && ['uploading', 'paused', 'analyzing'].includes(data.status)) {
            setStatus(data.status);
            updateProgress({
              total: data.total_files,
              completed: data.processed_files,
              successful: data.successful_files,
              failed: data.failed_files,
              skipped: data.skipped_files,
              current: data.current_file || '',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateProgress, setStatus]);

  // Cleanup old sessions (older than 24 hours)
  useEffect(() => {
    const cleanup = async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('upload_sessions')
        .delete()
        .lt('updated_at', cutoff);
    };
    
    cleanup();
  }, []);

  return { deviceId: deviceId.current };
}
