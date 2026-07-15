import { StitchShell } from '@/components/stitch-shell';
import { StitchScreenFrame } from '@/components/stitch-screen-frame';

export default function StockPage() {
  return (
    <StitchShell activePath="/">
      <StitchScreenFrame screen="stock" />
    </StitchShell>
  );
}