import React, { useState, useCallback, useRef, useEffect, CSSProperties } from 'react';
import { AspectRatio, Character, Scene, GeneratedImage } from './types';
import { generateImage } from './services/geminiService';
import { CharacterManager } from './components/CharacterManager';
import { DownloadIcon, RetryIcon, EditIcon, CloseIcon, PencilIcon, StopIcon } from './components/Icons';


// Mock process.env.API_KEY for browser environment if it's not set by a bundler
if (!process.env.API_KEY) {
    // In a real app, this should be handled securely and not hardcoded.
    // This is a placeholder for development environments.
    console.warn("API_KEY is not set. Using a placeholder. This will fail API calls.");
    process.env.API_KEY = "YOUR_API_KEY_HERE";
}

const DEFAULT_PROMPT = `Cảnh 32: Câu hỏi thực tế
Nội dung: "'Is he hurt? Does he have a collar?'"
Nội dung (Tiếng Việt): "'Nó có bị thương không? Có vòng cổ không?'"
Địa điểm: "in the living room".
Thời gian: "Night" (Tối).
Prompt (Câu lệnh tiếng Anh): (Visual Style Guide) A digital painting, close-up on "Claire Hartley" (CIL: early 60s, kind but practical eyes). Her expression is focused and concerned, not sentimental yet, as she asks the "practical" (from C31) questions, "'Is he hurt? Does he have a collar?'" Warm interior light, 4K, realistic emotion.
Nhân vật: Claire Hartley
Thời lượng ảnh: 5-7 giây (Nhịp độ cơ bản)
Ken Burns Effect (Chỉ đạo đạo diễn): Static (Không di chuyển). Giữ tĩnh để tập trung vào những câu hỏi nhanh, thực tế của bà.`;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ImageEditorModalProps {
  image: GeneratedImage;
  onSave: (editedSrc: string) => void;
  onSaveAsNew: (editedSrc: string) => void;
  onClose: () => void;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ image, onSave, onSaveAsNew, onClose }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [filters, setFilters] = useState({
        brightness: 100,
        contrast: 100,
        sepia: 0,
        grayscale: 0,
    });
    
    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [dragInfo, setDragInfo] = useState<{
        type: 'move' | 'resize';
        handle?: string;
        startX: number;
        startY: number;
        initialCrop: typeof crop;
    } | null>(null);

    const imageRef = useRef<HTMLImageElement>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    const resetCrop = useCallback(() => {
        if (imageRef.current) {
            setCrop({
                x: 0,
                y: 0,
                width: imageRef.current.offsetWidth,
                height: imageRef.current.offsetHeight,
            });
        }
    }, []);

    useEffect(() => {
        const img = imageRef.current;
        if (img) {
            const handleLoad = () => setTimeout(resetCrop, 0);
            
            if (img.complete && img.naturalWidth > 0) {
                handleLoad();
            } else {
                img.addEventListener('load', handleLoad);
            }
            
            const resizeObserver = new ResizeObserver(resetCrop);
            resizeObserver.observe(img);

            return () => {
                img.removeEventListener('load', handleLoad);
                resizeObserver.unobserve(img);
            };
        }
    }, [image.src, resetCrop]);

    const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!imageContainerRef.current) return;
        const rect = imageContainerRef.current.getBoundingClientRect();
        setDragInfo({
            type,
            handle,
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top,
            initialCrop: crop,
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragInfo || !imageRef.current || !imageContainerRef.current) return;

            const rect = imageContainerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const dx = mouseX - dragInfo.startX;
            const dy = mouseY - dragInfo.startY;

            let newCrop = { ...dragInfo.initialCrop };

            if (dragInfo.type === 'move') {
                newCrop.x += dx;
                newCrop.y += dy;
            } else if (dragInfo.type === 'resize') {
                const { handle } = dragInfo;
                if (handle?.includes('e')) newCrop.width += dx;
                if (handle?.includes('w')) {
                    newCrop.width -= dx;
                    newCrop.x += dx;
                }
                if (handle?.includes('s')) newCrop.height += dy;
                if (handle?.includes('n')) {
                    newCrop.height -= dy;
                    newCrop.y += dy;
                }
            }

            const MIN_SIZE = 20;
            if (newCrop.width < MIN_SIZE) {
                newCrop.width = MIN_SIZE;
                if (dragInfo.type === 'resize' && dragInfo.handle?.includes('w')) {
                    newCrop.x = dragInfo.initialCrop.x + dragInfo.initialCrop.width - MIN_SIZE;
                }
            }
            if (newCrop.height < MIN_SIZE) {
                newCrop.height = MIN_SIZE;
                 if (dragInfo.type === 'resize' && dragInfo.handle?.includes('n')) {
                    newCrop.y = dragInfo.initialCrop.y + dragInfo.initialCrop.height - MIN_SIZE;
                }
            }
            
            const { offsetWidth: imgWidth, offsetHeight: imgHeight } = imageRef.current;
            newCrop.x = Math.max(0, Math.min(newCrop.x, imgWidth - newCrop.width));
            newCrop.y = Math.max(0, Math.min(newCrop.y, imgHeight - newCrop.height));
            newCrop.width = Math.min(newCrop.width, imgWidth - newCrop.x);
            newCrop.height = Math.min(newCrop.height, imgHeight - newCrop.y);

            setCrop(newCrop);
        };

        const handleMouseUp = () => setDragInfo(null);

        if (dragInfo) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragInfo]);
    
    const getHandleStyle = (handle: string): React.CSSProperties => {
        const style: React.CSSProperties = {};
        if (handle.includes('n')) style.top = 0;
        if (handle.includes('s')) style.bottom = 0;
        if (handle.includes('w')) style.left = 0;
        if (handle.includes('e')) style.right = 0;
        if (handle.length === 1) {
            if (['n', 's'].includes(handle)) style.left = '50%';
            if (['w', 'e'].includes(handle)) style.top = '50%';
        }
        return style;
    };
    
    const handleToCursor: { [key: string]: string } = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize' };

    const filterStyle: CSSProperties = {
        filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) sepia(${filters.sepia}%) grayscale(${filters.grayscale}%)`,
    };

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: parseInt(value) }));
    };
    
    const resetFilters = () => {
        setFilters({ brightness: 100, contrast: 100, sepia: 0, grayscale: 0 });
    };

    const applyChanges = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Canvas context not available');
                
                let sourceRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
                if (isCropping && imageRef.current) {
                    const displayImg = imageRef.current;
                    sourceRect = {
                        x: (crop.x / displayImg.offsetWidth) * img.naturalWidth,
                        y: (crop.y / displayImg.offsetHeight) * img.naturalHeight,
                        width: (crop.width / displayImg.offsetWidth) * img.naturalWidth,
                        height: (crop.height / displayImg.offsetHeight) * img.naturalHeight,
                    };
                }

                canvas.width = sourceRect.width;
                canvas.height = sourceRect.height;
                
                ctx.filter = filterStyle.filter as string;
                
                ctx.drawImage(
                    img,
                    sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
                    0, 0, canvas.width, canvas.height
                );

                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = image.src;
        });
    };

    const handleSaveWrapper = async (saveFn: (src: string) => void) => {
        setIsProcessing(true);
        try {
            const editedSrc = await applyChanges();
            saveFn(editedSrc);
        } catch (error) {
            console.error("Failed to apply image edits:", error);
        } finally {
            setIsProcessing(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col text-gray-200">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Image Editor</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700" aria-label="Close editor">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    <div className="flex-1 flex items-center justify-center p-4 bg-gray-900 overflow-hidden">
                         <div ref={imageContainerRef} className="relative w-full h-full flex items-center justify-center">
                            <img
                                ref={imageRef}
                                src={image.src}
                                alt="Editing preview"
                                style={filterStyle}
                                className="max-w-full max-h-full object-contain"
                                onDragStart={(e) => e.preventDefault()}
                            />
                            {isCropping && imageRef.current?.complete && (
                                <>
                                    <div
                                        className="absolute border-2 border-dashed border-white cursor-move"
                                        style={{
                                            left: crop.x, top: crop.y, width: crop.width, height: crop.height,
                                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'move')}
                                        role="presentation"
                                    >
                                        {Object.keys(handleToCursor).map((handle) => (
                                            <div
                                                key={handle}
                                                className="absolute w-3 h-3 bg-white border border-gray-800 -m-1.5"
                                                style={{...getHandleStyle(handle), cursor: handleToCursor[handle]}}
                                                onMouseDown={(e) => handleMouseDown(e, 'resize', handle)}
                                                role="presentation"
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <aside className="w-full lg:w-80 bg-gray-800 p-4 space-y-6 overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-700">
                        <div className="space-y-4">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-lg font-semibold">Crop Image</span>
                                <div className="relative">
                                    <input type="checkbox" checked={isCropping} onChange={() => setIsCropping(!isCropping)} className="sr-only peer" id="crop-toggle" />
                                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                </div>
                            </label>
                            {isCropping && (
                                <button onClick={resetCrop} className="w-full text-sm bg-gray-600 hover:bg-gray-500 py-2 rounded-md transition-colors">Reset Crop</button>
                            )}
                        </div>
                        <div className="border-t border-gray-700 pt-6 space-y-6">
                            <h3 className="text-lg font-semibold">Filters</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="brightness-slider" className="block text-sm">Brightness: {filters.brightness}%</label>
                                    <input id="brightness-slider" type="range" min="0" max="200" value={filters.brightness} onChange={e => handleFilterChange('brightness', e.target.value)} className="w-full" />
                                </div>
                                <div>
                                    <label htmlFor="contrast-slider" className="block text-sm">Contrast: {filters.contrast}%</label>
                                    <input id="contrast-slider" type="range" min="0" max="200" value={filters.contrast} onChange={e => handleFilterChange('contrast', e.target.value)} className="w-full" />
                                </div>
                                <div>
                                    <label htmlFor="sepia-slider" className="block text-sm">Sepia: {filters.sepia}%</label>
                                    <input id="sepia-slider" type="range" min="0" max="100" value={filters.sepia} onChange={e => handleFilterChange('sepia', e.target.value)} className="w-full" />
                                </div>
                                <div>
                                    <label htmlFor="grayscale-slider" className="block text-sm">Grayscale: {filters.grayscale}%</label>
                                    <input id="grayscale-slider" type="range" min="0" max="100" value={filters.grayscale} onChange={e => handleFilterChange('grayscale', e.target.value)} className="w-full" />
                                </div>
                            </div>
                            <button onClick={resetFilters} className="w-full text-sm bg-gray-600 hover:bg-gray-500 py-2 rounded-md transition-colors">Reset Filters</button>
                        </div>
                    </aside>
                </main>

                <footer className="p-4 border-t border-gray-700 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button onClick={onClose} disabled={isProcessing} className="w-full sm:w-auto px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50">Cancel</button>
                    <button onClick={() => handleSaveWrapper(onSaveAsNew)} disabled={isProcessing} className="w-full sm:w-auto px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50">
                        {isProcessing ? 'Processing...' : 'Save as New'}
                    </button>
                    <button onClick={() => handleSaveWrapper(onSave)} disabled={isProcessing} className="w-full sm:w-auto px-4 py-2 bg-cyan-600 rounded-md hover:bg-cyan-500 font-semibold transition-colors disabled:opacity-50">
                        {isProcessing ? 'Processing...' : 'Save'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

interface PromptEditorModalProps {
    image: GeneratedImage;
    onSave: (newScript: string) => void;
    onClose: () => void;
}

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({ image, onSave, onClose }) => {
    const [editedScript, setEditedScript] = useState(image.sceneScript);

    // FIX: Force sync state with prop to prevent stale data when component is reused.
    useEffect(() => {
        setEditedScript(image.sceneScript);
    }, [image.sceneScript]);

    const handleSave = () => {
        onSave(editedScript);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col text-gray-200">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Edit Scene Script</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700" aria-label="Close editor">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-4">
                    <textarea
                        value={editedScript}
                        onChange={(e) => setEditedScript(e.target.value)}
                        rows={15}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                        placeholder="Enter your new scene script here..."
                    />
                </main>
                <footer className="p-4 border-t border-gray-700 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 rounded-md hover:bg-cyan-500 font-semibold transition-colors">Save & Regenerate</button>
                </footer>
            </div>
        </div>
    );
};

// Helper function to prevent dialogue text from being sent to the AI
const removeDialogue = (prompt: string): string => {
  // This regex targets strings in single or double quotes that are likely dialogue
  // by looking for longer sequences of characters (e.g., more than 15).
  // It replaces the dialogue with a generic instruction to show the character is speaking.
  // This preserves the context of the action while removing the problematic text.
  const processedPrompt = prompt.replace(/'[^']{15,}'/g, '(nhân vật đang nói)');
  return processedPrompt.replace(/"[^"]{15,}"/g, '(nhân vật đang nói)');
};


function App() {
  const [storyContext, setStoryContext] = useState<string>('');
  const [artStyle, setArtStyle] = useState<string>('');
  const [promptsText, setPromptsText] = useState<string>(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [batchSize, setBatchSize] = useState<number>(10);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [editingPromptImage, setEditingPromptImage] = useState<GeneratedImage | null>(null);
  const isStoppingRef = useRef(false);


  // Automatically filter out any scene-like prompts from the story context
  // to avoid confusing the AI.
  const cleanStoryContext = (text: string): string => {
    const sceneStartIndex = text.search(/Cảnh \d+:/);
    // If a scene block is found, take everything before it as the true context.
    if (sceneStartIndex !== -1) {
      return text.substring(0, sceneStartIndex).trim();
    }
    // Otherwise, use the text as is.
    return text;
  };

  const parsePrompts = (text: string): Scene[] => {
    const scenes: Scene[] = [];
    const sceneBlockRegex = /(Cảnh \d+:[\s\S]*?)(?=Cảnh \d+:|$)/g;
    const sceneNumberRegex = /Cảnh (\d+):/;
    const promptRegex = /Prompt \(Câu lệnh tiếng Anh\):\s*([\s\S]*?)(?=\nNhân vật:|\nThời lượng ảnh:|\nKen Burns Effect:|$)/;
    const characterRegex = /Nhân vật:\s*(.*?)(?:\n|$)/;

    const sceneBlocks = text.match(sceneBlockRegex) || [];

    for (const sceneBlock of sceneBlocks) {
      const sceneNumberMatch = sceneBlock.match(sceneNumberRegex);
      const promptMatch = sceneBlock.match(promptRegex);
      const characterMatch = sceneBlock.match(characterRegex);

      if (sceneNumberMatch && promptMatch && promptMatch[1]) {
        scenes.push({
          prompt: promptMatch[1].trim(),
          characterName: (characterMatch && characterMatch[1]) ? characterMatch[1].trim() : 'Không',
          fullText: sceneBlock.trim(),
          sceneNumber: parseInt(sceneNumberMatch[1], 10),
        });
      }
    }
    return scenes;
  };
  
  const handleStop = () => {
    isStoppingRef.current = true;
  };

  const handleGenerate = async () => {
    isStoppingRef.current = false;
    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    
    const cleanedStoryContext = cleanStoryContext(storyContext);

    const scenes = parsePrompts(promptsText).slice(0, batchSize);
    if (scenes.length === 0) {
      setError("Không tìm thấy prompt hợp lệ nào. Vui lòng kiểm tra định dạng đầu vào.");
      setIsGenerating(false);
      return;
    }

    const initialImages: GeneratedImage[] = scenes.map((scene) => ({
      id: crypto.randomUUID(),
      prompt: scene.prompt,
      sceneName: `Cảnh ${scene.sceneNumber}`,
      src: '',
      isLoading: true,
      characterRefId: characters.find(c => scene.characterName.toLowerCase().includes(c.name.toLowerCase()))?.id,
      isSelected: false,
      sceneScript: scene.fullText,
    }));
    setGeneratedImages(initialImages);
    
    const sceneImages: (string | undefined)[] = Array(scenes.length).fill(undefined);

    for (let i = 0; i < initialImages.length; i++) {
        const image = initialImages[i];
        
        if (isStoppingRef.current) {
            console.log("Generation stopped by user.");
            setGeneratedImages(currentImages =>
                currentImages.map((img, index) =>
                    index >= i ? { ...img, isLoading: false, src: 'cancelled' } : img
                )
            );
            break;
        }

        const referenceImage = i > 0 ? sceneImages[i - 1] : undefined;
        const isVariant = false; 
        
        const MAX_ATTEMPTS = 3;
        let success = false;
        let generatedBase64: string | null = null;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !success; attempt++) {
            try {
                const characterRef = characters.find(c => c.id === image.characterRefId);
                const promptForApi = removeDialogue(image.prompt);
                
                console.log(`Generating image for ${image.sceneName}, attempt ${attempt}/${MAX_ATTEMPTS}`);
                generatedBase64 = await generateImage(promptForApi, cleanedStoryContext, artStyle, aspectRatio, characterRef, referenceImage, isVariant);
                success = true;

            } catch (err) {
                console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed for prompt: ${image.prompt}`, err);
                if (attempt < MAX_ATTEMPTS) {
                    await sleep(5000); // Wait 5s before retrying
                }
            }
        }
        
        if (isStoppingRef.current) {
            setGeneratedImages(currentImages =>
                currentImages.map((img, index) =>
                    index >= i ? { ...img, isLoading: false, src: 'cancelled' } : img
                )
            );
            break;
        }

        if (success && generatedBase64) {
            const newSrc = `data:image/png;base64,${generatedBase64}`;
            sceneImages[i] = newSrc;
            setGeneratedImages(currentImages => {
                const newImages = [...currentImages];
                newImages[i] = { ...newImages[i], src: newSrc, isLoading: false };
                return newImages;
            });
        } else {
            sceneImages[i] = undefined;
            setGeneratedImages(currentImages => {
                const newImages = [...currentImages];
                newImages[i] = { ...newImages[i], src: 'error', isLoading: false };
                return newImages;
            });
        }
    }

    setIsGenerating(false);
  };
  
  const handleRegenerateAll = async () => {
    if (isGenerating || generatedImages.length === 0) return;

    isStoppingRef.current = false;
    setIsGenerating(true);
    setError(null);

    const cleanedStoryContext = cleanStoryContext(storyContext);
    const originalImages = [...generatedImages];

    // Set all to loading
    setGeneratedImages(prev => prev.map(img => ({ ...img, isLoading: true })));
    
    // This will hold the newly generated srcs, initialized with old ones that are valid.
    // It's crucial for passing the *new* previous image as a reference.
    const newImageSrcs = originalImages.map(img => (img.src.startsWith('data:image') ? img.src : undefined));

    for (let i = 0; i < originalImages.length; i++) {
        const image = originalImages[i];

        if (isStoppingRef.current) {
            console.log("Refinement stopped by user.");
            // Reset loading state for remaining images
            setGeneratedImages(currentImages =>
                currentImages.map((img, index) =>
                    index >= i ? { ...img, isLoading: false } : img
                )
            );
            break;
        }

        // Reference image is the *newly* refined one from the previous step.
        const referenceImage = i > 0 ? newImageSrcs[i - 1] : undefined;
        const isVariant = true; 

        const MAX_ATTEMPTS = 3;
        let success = false;
        let generatedBase64: string | null = null;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !success; attempt++) {
            try {
                const characterRef = characters.find(c => c.id === image.characterRefId);
                const promptForApi = removeDialogue(image.prompt);
                
                console.log(`Refining image for ${image.sceneName}, attempt ${attempt}/${MAX_ATTEMPTS}`);
                generatedBase64 = await generateImage(promptForApi, cleanedStoryContext, artStyle, aspectRatio, characterRef, referenceImage, isVariant);
                success = true;
            } catch (err) {
                console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed for refining prompt: ${image.prompt}`, err);
                if (attempt < MAX_ATTEMPTS) {
                    await sleep(5000);
                }
            }
        }

        if (isStoppingRef.current) {
            // handle stop again just in case it was pressed during the API call
            setGeneratedImages(currentImages =>
                currentImages.map((img, index) =>
                    index >= i ? { ...img, isLoading: false } : img
                )
            );
            break;
        }

        if (success && generatedBase64) {
            const newSrc = `data:image/png;base64,${generatedBase64}`;
            newImageSrcs[i] = newSrc; // Update the reference array for the next iteration
            setGeneratedImages(currentImages => {
                const newImages = [...currentImages];
                if(newImages[i]) {
                    newImages[i] = { ...newImages[i], src: newSrc, isLoading: false };
                }
                return newImages;
            });
        } else {
            newImageSrcs[i] = 'error'; // Mark as error so the next iteration's reference is undefined
             setGeneratedImages(currentImages => {
                const newImages = [...currentImages];
                if(newImages[i]) {
                   newImages[i] = { ...newImages[i], src: 'error', isLoading: false };
                }
                return newImages;
            });
        }
    }
    setIsGenerating(false);
  };

  const handleRegenerate = useCallback(async (imageId: string, promptOverride?: string) => {
    const imageIndex = generatedImages.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return;

    const imageToRegen = generatedImages[imageIndex];

    setGeneratedImages(prev => prev.map(img => img.id === imageId ? { ...img, isLoading: true } : img));
    
    const cleanedStoryContext = cleanStoryContext(storyContext);

    let referenceImage: string | undefined = undefined;
    const isVariant = true;
    
    const sceneNameMatch = imageToRegen.sceneName.match(/Cảnh (\d+)/);
    const sceneNumber = sceneNameMatch ? parseInt(sceneNameMatch[1], 10) : -1;

    if (sceneNumber !== -1) {
        const scenes = parsePrompts(promptsText);
        const currentSceneIndex = scenes.findIndex(s => s.sceneNumber === sceneNumber);
        
        if (currentSceneIndex > 0) {
            const prevSceneInfo = scenes[currentSceneIndex - 1];
            const prevSceneRegex = new RegExp(`^Cảnh ${prevSceneInfo.sceneNumber}`);
            const prevSceneImage = generatedImages.find(img => 
                prevSceneRegex.test(img.sceneName) && img.src && img.src !== 'error'
            );
            if (prevSceneImage) {
                referenceImage = prevSceneImage.src;
            }
        }
    }


    const finalPrompt = promptOverride ?? imageToRegen.prompt;
    const promptForApi = removeDialogue(finalPrompt);
    
    const MAX_ATTEMPTS = 3;
    let success = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !success; attempt++) {
        try {
            const characterRef = characters.find(c => c.id === imageToRegen.characterRefId);

            console.log(`Regenerating image ${imageId}, attempt ${attempt}/${MAX_ATTEMPTS}`);
            const imageBase64 = await generateImage(promptForApi, cleanedStoryContext, artStyle, aspectRatio, characterRef, referenceImage, isVariant);
            
            setGeneratedImages(prev => prev.map(img => 
                img.id === imageId 
                ? { ...img, src: `data:image/png;base64,${imageBase64}`, isLoading: false, prompt: finalPrompt, sceneScript: promptOverride ? imageToRegen.sceneScript.replace(/Prompt \(Câu lệnh tiếng Anh\):.*/s, `Prompt (Câu lệnh tiếng Anh): ${promptOverride}`) : imageToRegen.sceneScript } 
                : img
            ));
            success = true;
        } catch(err) {
            console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} for regenerating image ${imageId} failed`, err);
            if (attempt === MAX_ATTEMPTS) {
                setGeneratedImages(prev => prev.map(img => 
                    img.id === imageId 
                    ? { ...img, src: 'error', isLoading: false } 
                    : img
                ));
            } else {
                await sleep(5000);
            }
        }
    }
  }, [generatedImages, characters, aspectRatio, storyContext, artStyle, promptsText]);

  const downloadImage = (src: string, name: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `${name.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleSaveEdit = (editedSrc: string) => {
      if (!editingImage) return;
      setGeneratedImages(prev => 
          prev.map(img => 
              img.id === editingImage.id ? { ...img, src: editedSrc } : img
          )
      );
      setEditingImage(null);
  };

  const handleSaveAsNew = (editedSrc: string) => {
      if (!editingImage) return;
      const newImage: GeneratedImage = {
          ...editingImage,
          id: crypto.randomUUID(),
          src: editedSrc,
          isSelected: false,
          sceneName: `${editingImage.sceneName} (đã chỉnh sửa)`,
      };
      setGeneratedImages(prev => [...prev, newImage]);
      setEditingImage(null);
  };

  const handleCloseEditor = () => {
      setEditingImage(null);
  };
  
  const handlePromptEditSave = (newScript: string) => {
    if (!editingPromptImage) return;

    const promptRegex = /Prompt \(Câu lệnh tiếng Anh\):\s*([\s\S]*?)(?=\nNhân vật:|\nThời lượng ảnh:|\nKen Burns Effect:|$)/;
    const promptMatch = newScript.match(promptRegex);
    const newPrompt = (promptMatch && promptMatch[1]) ? promptMatch[1].trim() : newScript;
    
    const imageId = editingPromptImage.id;

    // Update the script in the state immediately for a better user experience
    setGeneratedImages(prev => prev.map(img => 
        img.id === imageId 
        ? { ...img, sceneScript: newScript, prompt: newPrompt } 
        : img
    ));
    
    setEditingPromptImage(null);
    handleRegenerate(imageId, newPrompt);
  };

  const handleClosePromptEditor = () => {
    setEditingPromptImage(null);
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <main className="container mx-auto p-4 lg:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Nano Banana Image Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">Công cụ tạo ảnh từ kịch bản chuyên nghiệp</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cột điều khiển */}
          <div className="lg:col-span-1 space-y-6">
            <div>
              <label htmlFor="storyContext" className="block text-sm font-medium text-gray-300 mb-2">
                Bối cảnh & Chỉ dẫn Tổng thể (Quan trọng)
              </label>
              <textarea
                id="storyContext"
                value={storyContext}
                onChange={(e) => setStoryContext(e.target.value)}
                rows={8}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                placeholder="Dán toàn bộ bối cảnh câu chuyện, mô tả chi tiết về nhân vật (diện mạo, trang phục), các chỉ dẫn về địa điểm. AI sẽ ghi nhớ toàn bộ thông tin này trước khi tạo từng ảnh."
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="artStyle" className="block text-sm font-medium text-gray-300 mb-2">
                Phong cách nghệ thuật xuyên suốt (Art Style)
              </label>
              <textarea
                id="artStyle"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                placeholder="Ví dụ: Tranh sơn dầu cổ điển, màu sắc u tối. Hoặc: Phong cách anime studio Ghibli. Hoặc: Ảnh chụp phim thập niên 90, màu sắc ấm áp..."
              ></textarea>
            </div>

            <div>
              <label htmlFor="prompts" className="block text-sm font-medium text-gray-300 mb-2">
                Lệnh tạo ảnh (Dán kịch bản phân cảnh vào đây)
              </label>
              <textarea
                id="prompts"
                value={promptsText}
                onChange={(e) => setPromptsText(e.target.value)}
                rows={15}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                placeholder="Dán kịch bản phân cảnh vào đây..."
              ></textarea>
            </div>
            
            <CharacterManager characters={characters} onCharactersChange={setCharacters} />

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Tỷ lệ khung hình</h3>
              <div className="grid grid-cols-4 gap-2">
                {(["1:1", "4:3", "16:9", "9:16"] as AspectRatio[]).map(ratio => (
                  <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`py-2 px-3 rounded-md text-sm transition-colors ${aspectRatio === ratio ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="batch-size" className="block text-sm font-medium text-gray-300 mb-2">
                Số lượng cảnh tạo (tối đa)
              </label>
              <select id="batch-size" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors">
                <option value={10}>10 cảnh</option>
                <option value={20}>20 cảnh</option>
                <option value={30}>30 cảnh</option>
              </select>
            </div>

            <div className="space-y-4">
              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-3 px-4 rounded-lg hover:from-red-600 hover:to-orange-600 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center"
                >
                  <StopIcon className="w-5 h-5 mr-2" />
                  Dừng tạo ảnh
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleGenerate}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 ease-in-out transform hover:scale-105"
                  >
                    Bắt đầu tạo ảnh
                  </button>
                  <button
                    onClick={handleRegenerateAll}
                    disabled={generatedImages.length === 0}
                    className="w-full bg-gradient-to-r from-teal-500 to-green-600 text-white font-bold py-3 px-4 rounded-lg hover:from-teal-600 hover:to-green-700 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-600 disabled:to-gray-700 flex items-center justify-center"
                  >
                    <RetryIcon className="w-5 h-5 mr-2" />
                    Tạo lại & Cải tiến
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cột hiển thị ảnh */}
          <div className="lg:col-span-2">
            {isGenerating && generatedImages.every(img => img.isLoading) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ length: Math.min(batchSize, parsePrompts(promptsText).length || batchSize) }).map((_, index) => (
                      <div key={index} className="aspect-w-16 aspect-h-9 bg-gray-800 rounded-lg animate-pulse"></div>
                  ))}
              </div>
            )}
            
            {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {generatedImages.map((image) => (
                <div key={image.id} className="group relative aspect-w-16 aspect-h-9 bg-gray-800 rounded-lg overflow-hidden">
                  {image.isLoading ? (
                    <div className="w-full h-full flex items-center justify-center animate-pulse">
                       <div className="flex items-center justify-center text-gray-400">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Đang tạo...</span>
                      </div>
                    </div>
                  ) : image.src === 'error' ? (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-red-900 bg-opacity-50 text-red-300">
                        <p className="text-sm">Tạo ảnh thất bại</p>
                        <button onClick={() => handleRegenerate(image.id)} className="mt-2 bg-red-700 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md text-sm flex items-center">
                            <RetryIcon className="w-4 h-4 mr-1" />
                            Thử lại
                        </button>
                    </div>
                  ) : image.src === 'cancelled' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-700 bg-opacity-50 text-gray-300">
                        <p className="text-sm font-semibold">Đã hủy</p>
                    </div>
                  ) : (
                    <>
                      <img src={image.src} alt={image.prompt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex flex-col justify-between p-2 text-white">
                        <p className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity line-clamp-3">{image.prompt}</p>
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setEditingPromptImage(image)} className="bg-purple-600 hover:bg-purple-500 p-2 rounded-full" title="Edit Prompt">
                                <PencilIcon className="w-5 h-5" />
                           </button>
                           <button onClick={() => setEditingImage(image)} className="bg-blue-600 hover:bg-blue-500 p-2 rounded-full" title="Edit Image">
                                <EditIcon className="w-5 h-5" />
                           </button>
                           <button onClick={() => handleRegenerate(image.id)} className="bg-gray-600 hover:bg-gray-500 p-2 rounded-full" title="Regenerate">
                                <RetryIcon className="w-5 h-5" />
                           </button>
                           <button onClick={() => downloadImage(image.src, image.sceneName)} className="bg-green-600 hover:bg-green-500 p-2 rounded-full" title="Download">
                                <DownloadIcon className="w-5 h-5" />
                           </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        {editingImage && (
            <ImageEditorModal
                key={editingImage.id}
                image={editingImage}
                onSave={handleSaveEdit}
                onSaveAsNew={handleSaveAsNew}
                onClose={handleCloseEditor}
            />
        )}
        {editingPromptImage && (
            <PromptEditorModal
                key={editingPromptImage.id}
                image={editingPromptImage}
                onSave={handlePromptEditSave}
                onClose={handleClosePromptEditor}
            />
        )}
      </main>
    </div>
  );
}

export default App;