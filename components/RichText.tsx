import React from 'react';

// Turns **double stars** into bold and [words](https://address) into a link. Nothing else is
// interpreted, and only https:// (or mailto:) addresses become links, so saved text can never run code.
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:https:\/\/|mailto:)[^)\s]+\))/g;

export const RichText: React.FC<{ text: string; linkClass?: string }> = ({ text, linkClass = 'text-[#367c92] font-black underline underline-offset-2' }) => {
  const parts = String(text || '').split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i} className="font-black">{part.slice(2, -2)}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(((?:https:\/\/|mailto:)[^)\s]+)\)$/);
        if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className={linkClass}>{link[1]}</a>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
};
