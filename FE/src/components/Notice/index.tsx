import { HardHat } from 'lucide-react';
import './styles.css';

export function Notice({ message }: { message: string }) {
  return (
    <div className="notice">
      <HardHat size={18} />
      <span>{message}</span>
    </div>
  );
}
