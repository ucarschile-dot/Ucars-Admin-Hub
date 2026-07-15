import { StitchShell } from '@/components/stitch-shell';
import { StitchScreenFrame } from '@/components/stitch-screen-frame';

export default function AgendaPage() {
  return (
    <StitchShell activePath="/agenda">
      <StitchScreenFrame screen="agenda" />
    </StitchShell>
  );
}