import { StitchShell } from '@/components/stitch-shell';
import { StitchScreenFrame } from '@/components/stitch-screen-frame';

export default function NotificationsPage() {
  return (
    <StitchShell activePath="/notificaciones">
      <StitchScreenFrame screen="notificaciones" />
    </StitchShell>
  );
}