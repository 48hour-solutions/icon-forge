
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Expand, Hammer, Paintbrush, Palette, Ratio, Sparkles, Trash2, UploadCloud, Wand2, X } from "lucide-react";
import React, { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { generateIconAction, improvePromptAction } from "@/app/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ICON_STYLES, PREDEFINED_PALETTES, SHADOW_STYLES } from "@/lib/constants";
import type { IconData, IconForgeFormValues, IconStyle } from "@/lib/types";

const removeWhiteBackground = (dataUri: string, style: IconStyle): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context.'));
      }
      ctx.drawImage(img, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;
        
        if (style === 'Outlined') {
          // For outlined icons, we assume any white pixel is background and should be removed.
          const tolerance = 40; // Handles anti-aliasing artifacts near white.
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) {
              data[i + 3] = 0; // Make transparent
            }
          }
        } else {
          // For other styles, use the "magic wand" flood-fill from the edges.
          const tolerance = 20;
          const visited = new Set<string>();

          const getIndex = (x: number, y: number) => (y * width + x) * 4;

          const floodFill = (startX: number, startY: number) => {
            const startNode = `${startX},${startY}`;
            if (visited.has(startNode)) {
              return;
            }

            const startIdx = getIndex(startX, startY);
            if (data[startIdx + 3] === 0) {
              return;
            }
            
            const r_bg = data[startIdx];
            const g_bg = data[startIdx + 1];
            const b_bg = data[startIdx + 2];
            
            const queue: [number, number][] = [[startX, startY]];
            visited.add(startNode);

            while (queue.length) {
              const [x, y] = queue.shift()!;
              const idx = getIndex(x, y);

              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              const isMatch =
                Math.abs(r - r_bg) <= tolerance &&
                Math.abs(g - g_bg) <= tolerance &&
                Math.abs(b - b_bg) <= tolerance;
              
              if (isMatch) {
                data[idx + 3] = 0;

                const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                for (const [nx, ny] of neighbors) {
                  const neighborNode = `${nx},${ny}`;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(neighborNode)) {
                    visited.add(neighborNode);
                    queue.push([nx, ny]);
                  }
                }
              }
            }
          };

          for (let x = 0; x < width; x++) {
            floodFill(x, 0);
            floodFill(x, height - 1);
          }
          for (let y = 0; y < height; y++) {
            floodFill(0, y);
            floodFill(width - 1, y);
          }
        }
        
        // Anti-aliasing pass to clean up jagged edges and white halos (beneficial for all styles)
        for (let i = 0; i < data.length; i += 4) {
          // If the pixel is fully opaque, it might be an edge pixel that needs smoothing.
          if (data[i + 3] === 255) {
            let isEdge = false;
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);

            // Check its 8 neighbors to see if any are transparent.
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const neighborIndex = (ny * width + nx) * 4;
                  if (data[neighborIndex + 3] === 0) {
                    isEdge = true;
                    break;
                  }
                }
              }
              if (isEdge) break;
            }

            if (isEdge) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // This is an anti-aliased edge pixel blended with a white background.
              // We estimate its original alpha by how "white" it is. A common heuristic is:
              const alpha = 1 - (Math.min(r, g, b) / 255);

              // Now, we "un-premultiply" the color to remove the white background's contribution.
              // C_original = (C_blend - (1 - alpha) * C_background) / alpha
              if (alpha > 0.05) { // Add a small threshold to avoid division by zero
                  data[i] = Math.max(0, Math.min(255, (r - (1 - alpha) * 255) / alpha));
                  data[i + 1] = Math.max(0, Math.min(255, (g - (1 - alpha) * 255) / alpha));
                  data[i + 2] = Math.max(0, Math.min(255, (b - (1 - alpha) * 255) / alpha));
                  data[i + 3] = alpha * 255;
              } else {
                  // If the pixel is almost pure white, make it fully transparent.
                  data[i + 3] = 0;
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('Canvas processing error:', e);
        reject(new Error('Could not process image due to cross-origin restrictions.'));
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for background removal.'));
    };
    img.src = dataUri;
  });
};

const formSchema = z.object({
  prompt: z.string().min(10, { message: "Prompt must be at least 10 characters." }),
  style: z.enum(ICON_STYLES as [string, ...string[]]),
  width: z.coerce.number().int().min(16, "Min 16px").max(1024, "Max 1024px"),
  height: z.coerce.number().int().min(16, "Min 16px").max(1024, "Max 1024px"),
  paletteName: z.string().optional(),
  shadow: z.enum(SHADOW_STYLES as [string, ...string[]]),
  referenceImageDataUri: z.string().optional(),
});

const PREDEFINED_SIZES = [32, 64, 128, 256];

export default function IconForgePage() {
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, startSuggestionTransition] = useTransition();
  const { toast } = useToast();

  const [activeIcon, setActiveIcon] = useState<IconData | null>(null);
  const [generatedIcons, setGeneratedIcons] = useState<IconData[]>([]);
  const [improvedPrompts, setImprovedPrompts] = useState<string[]>([]);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [useCustomResolution, setUseCustomResolution] = useState(false);


  const [iconToDelete, setIconToDelete] = useState<IconData | null>(null);
  const [isRecolorDialogOpen, setIsRecolorDialogOpen] = useState(false);
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);
  const [recolorPalette, setRecolorPalette] = useState<string | undefined>(PREDEFINED_PALETTES[0].name);

  useEffect(() => {
    try {
      const storedIcons = localStorage.getItem("generatedIcons");
      if (storedIcons) {
        const parsedIcons = JSON.parse(storedIcons).map((icon: any) => ({
          ...icon,
          createdAt: new Date(icon.createdAt),
        }));
        setGeneratedIcons(parsedIcons);
      }
    } catch (error) {
      console.error("Failed to load icons from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("generatedIcons", JSON.stringify(generatedIcons));
    } catch (error) {
      console.error("Failed to save icons to localStorage", error);
    }
  }, [generatedIcons]);

  const form = useForm<IconForgeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "A rocket ship soaring through clouds",
      style: "Flat",
      width: 256,
      height: 256,
      paletteName: PREDEFINED_PALETTES[0].name,
      shadow: "None",
      referenceImageDataUri: undefined,
    },
  });
  
  const { width, height } = form.watch();

  const readFileAsDataUri = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUri = reader.result as string;
      setReferenceImage(dataUri);
      form.setValue('referenceImageDataUri', dataUri);
    };
    reader.readAsDataURL(file);
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUri(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              readFileAsDataUri(blob as File);
            }
            e.preventDefault();
            return;
        }
    }
  };

  const handleRemoveReferenceImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setReferenceImage(null);
    form.setValue('referenceImageDataUri', undefined);
  };


  const generateIcon = async (values: IconForgeFormValues, referenceUri?: string) => {
      const selectedPalette = PREDEFINED_PALETTES.find(p => p.name === values.paletteName);
      
      const promptParts = [];
      let corePrompt;

      // New logic based on style
      switch (values.style) {
        case 'Outlined':
          // Be very specific for 'Outlined' style
          corePrompt = `A clean, single-color, line art icon of ${values.prompt}. The icon must ONLY be outlines, like a coloring book page. The interior of the shapes must be empty/transparent. No fill colors, no gradients, no shading. Just the lines.`;
          break;
        case 'Flat':
          corePrompt = `A flat design icon of ${values.prompt}. Simple shapes, solid colors. No gradients or 3D effects.`;
          break;
        case 'Filled':
          // This is essentially the default style the AI was producing anyway.
          corePrompt = `A filled vector icon of ${values.prompt}, with distinct outlines and solid color fills.`;
          break;
        case '3D':
          corePrompt = `A 3D rendered icon of ${values.prompt}, with depth, shading, and highlights to create a three-dimensional appearance.`;
          break;
        case 'Hand-drawn':
          corePrompt = `A hand-drawn icon of ${values.prompt}, with an organic, sketchy, imperfect line quality.`;
          break;
        default:
          // Fallback just in case
          corePrompt = `A simple, clean icon of ${values.prompt}, in a ${values.style.toLowerCase()} style.`;
      }

      promptParts.push(corePrompt);

      if (selectedPalette) {
          const colorInstruction = values.style === 'Outlined'
              ? `The lines of the icon should primarily use this color palette: ${selectedPalette.colors.join(", ")}.`
              : `The icon should use this color palette: ${selectedPalette.colors.join(", ")}.`;
          promptParts.push(colorInstruction);
      }

      if (values.shadow !== 'None' && values.style !== 'Outlined') { // Shadows don't make sense for simple line art
          promptParts.push(`with a ${values.shadow.toLowerCase()} shadow.`);
      }
      
      if (referenceUri) {
          promptParts.push('Use the provided image as a strong reference for style, subject, and composition.');
      }

      promptParts.push('The final image must have a solid, plain white background for easy processing. Do not include any text, watermarks, or other artifacts.');

      const finalPrompt = promptParts.join('. ');
      
      const result = await generateIconAction({ 
        prompt: finalPrompt,
        referenceImageDataUri: referenceUri,
      });

      if (result.error || !result.data?.iconDataUri) {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: result.error || "Could not retrieve the generated icon.",
        });
        return;
      }

      try {
        const transparentDataUri = await removeWhiteBackground(result.data.iconDataUri, values.style);
        
        const newIcon: IconData = {
          id: new Date().toISOString(),
          prompt: values.prompt,
          dataUri: transparentDataUri,
          createdAt: new Date(),
          settings: values,
        };

        setActiveIcon(newIcon);
        setGeneratedIcons(prev => [newIcon, ...prev]);
        toast({
          title: "Icon Generated!",
          description: "Your new icon has been added to the library.",
        });
      } catch (error) {
        console.error("Failed to process image background:", error);
        toast({
          variant: "destructive",
          title: "Image Processing Failed",
          description: (error as Error).message || "Could not make the background transparent.",
        });
      }
  };

  const onSubmit = (values: IconForgeFormValues) => {
    startTransition(() => generateIcon(values, values.referenceImageDataUri));
  };

  const handleImprovePrompt = () => {
    const currentPrompt = form.getValues("prompt");
    if (!currentPrompt) {
      toast({ variant: "destructive", title: "Prompt is empty." });
      return;
    }
    startSuggestionTransition(async () => {
      const result = await improvePromptAction({ prompt: currentPrompt });
       if (result.error || !result.data?.improvedPrompts) {
        toast({ variant: "destructive", title: "Could not get suggestions." });
      } else {
        setImprovedPrompts(result.data.improvedPrompts);
      }
    });
  };

  const handleImprovedPromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
    setImprovedPrompts([]);
  };

  const handleIconSelect = (icon: IconData) => {
    setActiveIcon(icon);
    form.reset(icon.settings);
    setReferenceImage(icon.settings.referenceImageDataUri || null);
  };
  
  const handleDeleteIcon = () => {
    if (!iconToDelete) return;
    setGeneratedIcons(prev => prev.filter(icon => icon.id !== iconToDelete.id));
    if(activeIcon?.id === iconToDelete.id) {
        setActiveIcon(null);
    }
    setIconToDelete(null);
    toast({ title: "Icon Deleted", description: "The icon has been removed from your library." });
  }

  const handleRecolorIcon = () => {
    if (!activeIcon) return;
    setIsRecolorDialogOpen(false);
    startTransition(() => {
        const newSettings = { ...activeIcon.settings, paletteName: recolorPalette };
        generateIcon(newSettings, activeIcon.dataUri);
    });
  }

  return (
    <>
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex items-center gap-3">
        <Hammer className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Icon Forge</h1>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Settings Panel */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Customize Your Icon</CardTitle>
              <CardDescription>Use the settings below to craft your perfect icon.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> Prompt</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., A minimalist logo for a coffee shop" {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                        <div className="flex flex-col gap-2 pt-2">
                           <Button type="button" variant="outline" size="sm" onClick={handleImprovePrompt} disabled={isSuggesting}>
                            <Sparkles className="mr-2 h-4 w-4" /> {isSuggesting ? 'Improving...' : 'Improve Prompt'}
                          </Button>
                           {improvedPrompts.length > 0 && (
                            <div className="flex flex-col gap-2 pt-2">
                              {improvedPrompts.map((prompt, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleImprovedPromptClick(prompt)}
                                  className="p-3 text-left text-sm border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                >
                                  {prompt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormItem>
                      <FormLabel>Reference Image (Optional)</FormLabel>
                      <FormControl>
                          <div
                              className="relative flex items-center justify-center w-full p-2 border-2 border-dashed rounded-lg h-40 border-input hover:border-primary/50 cursor-pointer"
                              onPaste={handlePaste}
                              onClick={() => document.getElementById('image-upload')?.click()}
                          >
                              {referenceImage ? (
                                  <>
                                      <img src={referenceImage} alt="Reference" className="object-contain h-full max-w-full p-2 rounded-lg" data-ai-hint="reference image"/>
                                      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={handleRemoveReferenceImage}>
                                          <X className="w-4 h-4" />
                                      </Button>
                                  </>
                              ) : (
                                  <div className="text-center text-muted-foreground">
                                      <UploadCloud className="w-8 h-8 mx-auto mb-2" />
                                      <p>Click or paste an image</p>
                                  </div>
                              )}
                              <Input
                                  type="file"
                                  id="image-upload"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={handleImageUpload}
                              />
                          </div>
                      </FormControl>
                  </FormItem>
                  
                  <FormField
                    control={form.control}
                    name="style"
                    render={({ field }) => (
                      <FormItem>
                         <FormLabel>Style</FormLabel>
                         <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-2"
                          >
                            {ICON_STYLES.map(style => (
                              <FormItem key={style} className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={style} id={`style-${style}`} />
                                </FormControl>
                                <Label htmlFor={`style-${style}`} className="font-normal">{style}</Label>
                              </FormItem>
                            ))}
                          </RadioGroup>
                         </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Ratio className="h-4 w-4" /> Dimensions</FormLabel>
                    
                    {useCustomResolution ? (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="width" render={({ field }) => (
                          <FormItem><FormControl><Input type="number" placeholder="Width" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="height" render={({ field }) => (
                          <FormItem><FormControl><Input type="number" placeholder="Height" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    ) : (
                      <Select
                          onValueChange={(value) => {
                              const [newWidth, newHeight] = value.split('x').map(Number);
                              form.setValue('width', newWidth);
                              form.setValue('height', newHeight);
                          }}
                          value={`${width}x${height}`}
                      >
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a size" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {PREDEFINED_SIZES.map(size => (
                                  <SelectItem key={size} value={`${size}x${size}`}>{`${size} x ${size}`}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    )}

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="custom-resolution"
                            checked={useCustomResolution}
                            onCheckedChange={(checked) => {
                                setUseCustomResolution(!!checked);
                                if (!checked) {
                                    const currentWidth = form.getValues('width');
                                    const currentHeight = form.getValues('height');
                                    const isStandard = PREDEFINED_SIZES.includes(currentWidth) && currentWidth === currentHeight;
                                    if (!isStandard) {
                                        form.setValue('width', 256);
                                        form.setValue('height', 256);
                                    }
                                }
                            }}
                        />
                        <label
                            htmlFor="custom-resolution"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Use Custom Resolution
                        </label>
                    </div>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="paletteName"
                    render={({ field }) => (
                      <FormItem>
                         <FormLabel className="flex items-center gap-2"><Palette className="h-4 w-4" /> Color Palette</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a palette" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PREDEFINED_PALETTES.map(p => (
                              <SelectItem key={p.name} value={p.name}>
                                <div className="flex items-center gap-2">
                                  {p.colors.map(c => <div key={c} className="h-4 w-4 rounded-full border" style={{ backgroundColor: c }} />)}
                                  <span>{p.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                         </Select>
                      </FormItem>
                    )}
                  />

                   <FormField
                    control={form.control}
                    name="shadow"
                    render={({ field }) => (
                      <FormItem>
                         <FormLabel>Shadow</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select shadow style" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SHADOW_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                         </Select>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Generating..." : "Generate Icon"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Display & Library Panel */}
        <div className="flex flex-col gap-8 lg:col-span-8 xl:col-span-9">
          <Card className="flex-grow">
            <CardHeader>
              <CardTitle>Generated Icon</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center h-full">
              {isPending ? (
                 <div className="flex flex-col items-center justify-center w-full max-w-sm aspect-square">
                    <Skeleton className="w-full h-full rounded-lg" />
                    <Skeleton className="w-3/4 h-8 mt-4" />
                 </div>
              ) : activeIcon ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-grid-slate-100 rounded-lg border p-4 shadow-inner" style={{ backgroundSize: '20px 20px', backgroundImage: 'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)' }}>
                     <img 
                        src={activeIcon.dataUri} 
                        alt={activeIcon.prompt} 
                        className="transition-all"
                        style={{ width: `${activeIcon.settings.width}px`, height: `${activeIcon.settings.height}px`, maxWidth: '100%', maxHeight: '400px' }}
                        data-ai-hint="icon" />
                  </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <a href={activeIcon.dataUri} download={`icon-forge-${Date.now()}.png`}>
                            <Button><Download className="mr-2 h-4 w-4" />Download PNG</Button>
                        </a>
                        <Button variant="outline" onClick={() => setIsRecolorDialogOpen(true)}><Paintbrush className="mr-2 h-4 w-4" />Recolor</Button>
                        <Button variant="outline" onClick={() => setIsExpandedViewOpen(true)}><Expand className="mr-2 h-4 w-4" />Expand</Button>
                        <Button variant="destructive" onClick={() => setIconToDelete(activeIcon)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                    </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-10">
                  <p>Your generated icon will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {generatedIcons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Icon Library</CardTitle>
                <CardDescription>Your previously generated icons. Click to view and edit.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {generatedIcons.map(icon => (
                     <button key={icon.id} onClick={() => handleIconSelect(icon)} className={`p-2 rounded-lg border-2 transition-all ${activeIcon?.id === icon.id ? 'border-primary' : 'border-transparent hover:border-muted-foreground/50'}`}>
                        <div className="aspect-square bg-grid-slate-100 rounded-md flex items-center justify-center p-1" style={{ backgroundSize: '10px 10px', backgroundImage: 'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)' }}>
                           <img src={icon.dataUri} alt={icon.prompt} className="max-w-full max-h-full" data-ai-hint="icon" />
                        </div>
                     </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
    <AlertDialog open={!!iconToDelete} onOpenChange={(open) => !open && setIconToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the icon from your library.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIconToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteIcon}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <Dialog open={isRecolorDialogOpen} onOpenChange={setIsRecolorDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Recolor Icon</DialogTitle>
                <DialogDescription>
                    Select a new color palette to apply to your icon. This will regenerate the icon using the new colors while preserving its shape.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="recolor-palette">New Palette</Label>
                <Select onValueChange={setRecolorPalette} defaultValue={recolorPalette}>
                    <SelectTrigger id="recolor-palette">
                        <SelectValue placeholder="Select a palette" />
                    </SelectTrigger>
                    <SelectContent>
                        {PREDEFINED_PALETTES.map(p => (
                            <SelectItem key={p.name} value={p.name}>
                            <div className="flex items-center gap-2">
                                {p.colors.map(c => <div key={c} className="h-4 w-4 rounded-full border" style={{ backgroundColor: c }} />)}
                                <span>{p.name}</span>
                            </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsRecolorDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleRecolorIcon} disabled={isPending}>
                    {isPending ? "Recoloring..." : "Apply & Regenerate"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog open={isExpandedViewOpen} onOpenChange={setIsExpandedViewOpen}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>Expanded View</DialogTitle>
                <DialogDescription>
                    {activeIcon?.prompt}
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-grid-slate-100 rounded-lg border shadow-inner" style={{ backgroundSize: '20px 20px', backgroundImage: 'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)' }}>
                {activeIcon && <img src={activeIcon.dataUri} alt={activeIcon.prompt} className="max-w-full max-h-[70vh] object-contain" data-ai-hint="icon" />}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsExpandedViewOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
