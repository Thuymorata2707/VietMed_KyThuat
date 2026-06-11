import { AlertTriangle } from 'lucide-react';
import './styles.css';

export function Notice({ message }: { message: string }) {
  return (
    <div className="notice">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}
