
import React, { useRef } from 'react';
import { Character } from '../types';
import { TrashIcon, PlusIcon } from './Icons';

interface CharacterManagerProps {
  characters: Character[];
  onCharactersChange: (characters: Character[]) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

export const CharacterManager: React.FC<CharacterManagerProps> = ({ characters, onCharactersChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      // FIX: Explicitly type `file` as `File` to resolve type inference issues.
      const newCharactersPromises = files.map(async (file: File) => {
        const base64 = await fileToBase64(file);
        const lastDotIndex = file.name.lastIndexOf('.');
        const characterName = lastDotIndex > 0 ? file.name.slice(0, lastDotIndex) : file.name;
        return {
          id: crypto.randomUUID(),
          name: characterName || 'Chưa đặt tên',
          imageBase64: base64,
          mimeType: file.type,
        };
      });
      const newCharacters = await Promise.all(newCharactersPromises);
      onCharactersChange([...characters, ...newCharacters]);
    }
  };

  const updateCharacterName = (id: string, name: string) => {
    const updated = characters.map((c) => (c.id === id ? { ...c, name } : c));
    onCharactersChange(updated);
  };

  const deleteCharacter = (id: string) => {
    const remaining = characters.filter((c) => c.id !== id);
    onCharactersChange(remaining);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Quản lý nhân vật tham chiếu</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {characters.map((char) => (
          <div key={char.id} className="group relative">
            <img
              src={`data:${char.mimeType};base64,${char.imageBase64}`}
              alt={char.name}
              className="w-full h-32 object-cover rounded-md"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <input
                type="text"
                value={char.name}
                onChange={(e) => updateCharacterName(char.id, e.target.value)}
                className="w-full bg-transparent text-white text-sm font-bold border-b border-gray-400 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button
              onClick={() => deleteCharacter(char.id)}
              className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-md hover:border-cyan-400 text-gray-400 hover:text-cyan-400 transition-colors"
        >
          <PlusIcon className="w-8 h-8" />
          <span className="text-sm mt-1">Tải ảnh lên</span>
        </button>
      </div>
      <input
        type="file"
        multiple
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
