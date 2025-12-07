import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUploadStore } from '@/stores/uploadStore';
import { useAuth } from '@/hooks/useAuth';

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
  const { sessions, updateProgress, setStatus } = useUploadStore();
  const { user, isAuthenticated } = useAuth();

  // Broadcast local changes to database for all active sessions
  useEffect(() => {
    // Only sync if user is authenticated
    if (!isAuthenticated || !user) return;

    const activeSessions = Object.values(sessions).filter(
      s => ['uploading', 'paused', 'analyzing'].includes(s.status)
    );

    if (activeSessions.length === 0) return;

    const syncToDb = async () => {
      for (const session of activeSessions) {
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
            user_id: user.id,
          }, {
            onConflict: 'session_id'
          });
        } catch (err) {
          console.error('Error syncing upload progress:', err);
        }
      }
    };

    syncToDb();
  }, [sessions, isAuthenticated, user]);

  // Listen for changes from other devices
  useEffect(() => {
    if (!isAuthenticated) return;

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
          if (data.session_id && data.status && ['uploading', 'paused', 'analyzing'].includes(data.status)) {
            setStatus(data.session_id, data.status);
            updateProgress(data.session_id, {
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
  }, [updateProgress, setStatus, isAuthenticated]);

  // Cleanup old sessions (older than 24 hours)
  useEffect(() => {
    if (!isAuthenticated) return;

    const cleanup = async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('upload_sessions')
        .delete()
        .lt('updated_at', cutoff);
    };
    
    cleanup();
  }, [isAuthenticated]);

  return { deviceId: deviceId.current };
}
