/* eslint-disable @next/next/no-img-element */
import { Image as ImageIcon } from 'lucide-react';
import { extractMediaUrl, renderMessageContent } from '../../lib/chatFormat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderMediaNode(msg: any) {
  const type = (msg?.type || msg?.messageType || msg?.fileType || '').toString().toLowerCase();
  const mediaUrl = extractMediaUrl(msg);
  const textContent = renderMessageContent(msg);

  if (type === 'image' || type === 'sticker' || (mediaUrl && textContent === '📷 Imagem')) {
    return (
      <div className="space-y-2">
        {mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={mediaUrl} 
              alt="Mídia do Chat" 
              className="max-w-xs max-h-64 rounded-xl border border-slate-700/50 object-cover cursor-pointer hover:opacity-80 transition-all duration-300 shadow-sm" 
            />
          </a>
        ) : (
          <span className="flex items-center gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 text-xs">
            <ImageIcon className="w-4 h-4 text-slate-400"/> Imagem indisponível
          </span>
        )}
        {textContent && textContent !== '📷 Imagem' && <p className="whitespace-pre-wrap">{textContent}</p>}
      </div>
    );
  }

  if (type === 'audio' || (mediaUrl && textContent === '🎤 Áudio')) {
    return (
      <div className="space-y-2 min-w-[250px] max-w-sm">
        {mediaUrl ? (
          <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-700/50 shadow-inner">
            <audio controls src={mediaUrl} className="w-full h-10 outline-none" />
            <a 
              href={mediaUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              download 
              className="text-[10px] text-slate-400 hover:text-blue-300 transition-colors underline text-center block" 
            >
              Baixar arquivo original
            </a>
          </div>
        ) : (
          <span className="flex items-center gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 text-xs">
            🎤 Áudio indisponível
          </span>
        )}
      </div>
    );
  }

  return <div className="whitespace-pre-wrap leading-relaxed">{textContent}</div>;
}
