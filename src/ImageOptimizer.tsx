"use client";

import {
  ArrowDownToLine,
  Check,
  Download,
  FileArchive,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type OutputFormat = "webp" | "avif" | "original";
type ItemStatus = "ready" | "processing" | "done" | "error";

type QueueItem = {
  id: string;
  file: File;
  sourceUrl: string;
  status: ItemStatus;
  resultBlob?: Blob;
  resultUrl?: string;
  outputName?: string;
  width?: number;
  height?: number;
  resultWidth?: number;
  resultHeight?: number;
  error?: string;
};

type ConversionResult = {
  blob: Blob;
  width: number;
  height: number;
  outputName: string;
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_FILES = 30;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function baseName(filename: string) {
  return filename.replace(/\.[^/.]+$/, "");
}

function originalExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpeg") return "jpeg";
  if (extension === "png") return "png";
  if (extension === "webp") return "webp";
  return file.type === "image/png" ? "png" : "jpg";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("O navegador não conseguiu gerar este formato."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function loadBitmap(file: File) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function convertImage(
  item: QueueItem,
  format: OutputFormat,
  quality: number,
  maxWidth: number,
): Promise<ConversionResult> {
  const source = await loadBitmap(item.file);
  const sourceWidth =
    "naturalWidth" in source ? source.naturalWidth : source.width;
  const sourceHeight =
    "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale =
    maxWidth > 0 && sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: format === "avif",
  });

  if (!context) {
    if ("close" in source) source.close();
    throw new Error("Não foi possível preparar a imagem.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  if ("close" in source) source.close();

  const sourceBaseName = baseName(item.file.name);
  let blob: Blob;
  let extension: string;

  if (format === "avif") {
    const { default: encode } = await import("@jsquash/avif/encode");
    const imageData = context.getImageData(0, 0, width, height);
    const output = await encode(imageData, {
      quality,
      qualityAlpha: Math.max(quality, 85),
      speed: 6,
      subsample: quality >= 88 ? 3 : 1,
    });
    blob = new Blob([output], { type: "image/avif" });
    extension = "avif";
  } else if (format === "webp") {
    blob = await canvasToBlob(canvas, "image/webp", quality / 100);
    if (blob.type !== "image/webp") {
      throw new Error("Seu navegador não oferece codificação WebP.");
    }
    extension = "webp";
  } else if (item.file.type === "image/png") {
    const { optimise } = await import("@jsquash/oxipng");
    const input =
      scale === 1
        ? await item.file.arrayBuffer()
        : await (await canvasToBlob(canvas, "image/png")).arrayBuffer();
    const output = await optimise(input, {
      level: 3,
      interlace: false,
      optimiseAlpha: false,
    });
    const optimized = new Blob([output], { type: "image/png" });
    blob =
      scale === 1 && optimized.size >= item.file.size ? item.file : optimized;
    extension = "png";
  } else {
    const mime = item.file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const optimized = await canvasToBlob(canvas, mime, quality / 100);
    blob =
      scale === 1 && optimized.size >= item.file.size ? item.file : optimized;
    extension =
      item.file.type === "image/webp"
        ? "webp"
        : originalExtension(item.file);
  }

  return {
    blob,
    width,
    height,
    outputName: `${sourceBaseName}-otimizada.${extension}`,
  };
}

function StatusBadge({ item }: { item: QueueItem }) {
  if (item.status === "processing") {
    return (
      <span className="status processing">
        <LoaderCircle className="spin" size={11} />
        Otimizando
      </span>
    );
  }
  if (item.status === "done") {
    return (
      <span className="status done">
        <Check size={11} />
        Pronta
      </span>
    );
  }
  if (item.status === "error") {
    return <span className="status error">Erro</span>;
  }
  return <span className="status ready">Na fila</span>;
}

export default function ImageOptimizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<QueueItem[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(82);
  const [maxWidth, setMaxWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  const completedItems = items.filter(
    (item) => item.status === "done" && item.resultBlob,
  );

  const totals = useMemo(() => {
    const original = completedItems.reduce(
      (total, item) => total + item.file.size,
      0,
    );
    const optimized = completedItems.reduce(
      (total, item) => total + (item.resultBlob?.size ?? 0),
      0,
    );
    const percent =
      original > 0 ? Math.round(((original - optimized) / original) * 100) : 0;
    return { original, optimized, percent };
  }, [completedItems]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.sourceUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
    };
  }, []);

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    const valid = incoming.filter(
      (file) => ALLOWED_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE,
    );
    const availableSlots = Math.max(0, MAX_FILES - items.length);
    const accepted = valid.slice(0, availableSlots);

    if (accepted.length !== incoming.length) {
      setMessage(
        `Alguns arquivos foram ignorados. Use PNG, JPEG ou WebP com até 30 MB; o limite é ${MAX_FILES} imagens.`,
      );
    } else {
      setMessage("");
    }

    if (!accepted.length) return;

    setItems((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: uid(),
        file,
        sourceUrl: URL.createObjectURL(file),
        status: "ready" as const,
      })),
    ]);
    setProgress(0);
  }

  function removeItem(id: string) {
    setItems((current) => {
      const item = current.find((candidate) => candidate.id === id);
      if (item) {
        URL.revokeObjectURL(item.sourceUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return current.filter((candidate) => candidate.id !== id);
    });
  }

  function clearAll() {
    items.forEach((item) => {
      URL.revokeObjectURL(item.sourceUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setItems([]);
    setProgress(0);
    setMessage("");
  }

  function resetResults() {
    setItems((current) =>
      current.map((item) => {
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        return {
          id: item.id,
          file: item.file,
          sourceUrl: item.sourceUrl,
          status: "ready",
        };
      }),
    );
    setProgress(0);
  }

  async function processAll() {
    if (!items.length || isProcessing) return;
    setIsProcessing(true);
    setMessage("");
    setProgress(0);

    const snapshot = [...items];
    let finished = 0;

    for (const queueItem of snapshot) {
      setItems((current) =>
        current.map((item) =>
          item.id === queueItem.id
            ? { ...item, status: "processing", error: undefined }
            : item,
        ),
      );

      try {
        const result = await convertImage(
          queueItem,
          format,
          quality,
          maxWidth,
        );
        const resultUrl = URL.createObjectURL(result.blob);

        setItems((current) =>
          current.map((item) => {
            if (item.id !== queueItem.id) return item;
            if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
            return {
              ...item,
              status: "done",
              resultBlob: result.blob,
              resultUrl,
              outputName: result.outputName,
              resultWidth: result.width,
              resultHeight: result.height,
            };
          }),
        );
      } catch (error) {
        setItems((current) =>
          current.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Não foi possível otimizar.",
                }
              : item,
          ),
        );
      }

      finished += 1;
      setProgress(Math.round((finished / snapshot.length) * 100));
    }

    setIsProcessing(false);
  }

  async function downloadAll() {
    if (!completedItems.length) return;
    if (completedItems.length === 1) {
      const item = completedItems[0];
      downloadBlob(item.resultBlob!, item.outputName!);
      return;
    }

    const { zipSync } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    for (const item of completedItems) {
      files[item.outputName!] = new Uint8Array(
        await item.resultBlob!.arrayBuffer(),
      );
    }
    const zip = zipSync(files, { level: 6 });
    downloadBlob(
      new Blob([zip], { type: "application/zip" }),
      "imagens-otimizadas.zip",
    );
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!isProcessing) addFiles(event.dataTransfer.files);
  }

  function openPicker() {
    if (!isProcessing) inputRef.current?.click();
  }

  function onDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  const formatLabel =
    format === "original"
      ? "formato original"
      : format === "avif"
        ? "AVIF"
        : "WebP";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Otimizador Web">
          <span className="brand-mark">
            <Sparkles size={17} strokeWidth={2.4} />
          </span>
          Otimizador Web
        </div>
        <div className="privacy-pill">
          <span className="privacy-dot" />
          <span className="privacy-copy">
            Seus arquivos não saem do dispositivo
          </span>
          <LockKeyhole size={13} />
        </div>
      </header>

      <main className="page">
        <section className="hero" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Imagens prontas para a web</p>
            <h1 id="page-title">
              Imagens menores.
              <br />
              Sites <span>mais rápidos.</span>
            </h1>
          </div>
          <p className="hero-copy">
            Converta para <strong>WebP ou AVIF</strong>, ou apenas otimize seu
            PNG e JPEG. Tudo acontece localmente no navegador, sem upload para
            servidores.
          </p>
        </section>

        <div className="workspace">
          <section
            className={`panel ${items.length ? "queue-panel" : "upload-panel"}`}
            aria-label="Arquivos para otimizar"
          >
            {!items.length ? (
              <>
                <div
                  className={`dropzone ${isDragging ? "is-dragging" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={openPicker}
                  onKeyDown={onDropzoneKeyDown}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  aria-label="Selecionar ou arrastar imagens"
                >
                  <span className="upload-icon">
                    <UploadCloud size={30} strokeWidth={1.8} />
                  </span>
                  <h2>Solte suas imagens aqui</h2>
                  <p>
                    PNG, JPEG ou WebP · até 30 arquivos
                    <br />
                    30 MB por imagem
                  </p>
                  <span className="choose-button">
                    <Plus size={15} />
                    Selecionar imagens
                  </span>
                </div>

                <div className="format-strip" aria-label="Benefícios">
                  <div className="format-benefit">
                    <span className="benefit-icon">
                      <Zap size={16} />
                    </span>
                    <div>
                      <strong>Mais velocidade</strong>
                      <span>Menos peso para carregar</span>
                    </div>
                  </div>
                  <div className="format-benefit">
                    <span className="benefit-icon">
                      <ShieldCheck size={16} />
                    </span>
                    <div>
                      <strong>100% privado</strong>
                      <span>Processamento no navegador</span>
                    </div>
                  </div>
                  <div className="format-benefit">
                    <span className="benefit-icon">
                      <Layers3 size={16} />
                    </span>
                    <div>
                      <strong>Uso profissional</strong>
                      <span>WordPress, Framer e Webflow</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="queue-header">
                  <div className="queue-title">
                    <h2>Suas imagens</h2>
                    <span className="count-badge">{items.length}</span>
                  </div>
                  <div>
                    <button
                      className="text-button"
                      type="button"
                      onClick={openPicker}
                      disabled={isProcessing}
                    >
                      <Plus size={13} />
                      Adicionar
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={clearAll}
                      disabled={isProcessing}
                    >
                      <Trash2 size={13} />
                      Limpar
                    </button>
                  </div>
                </div>

                {completedItems.length > 0 && (
                  <div className="summary" aria-label="Resumo da otimização">
                    <div className="summary-item">
                      <span>Antes</span>
                      <strong>{formatBytes(totals.original)}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Depois</span>
                      <strong>{formatBytes(totals.optimized)}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Economia</span>
                      <strong>
                        {totals.percent > 0 ? `${totals.percent}%` : "—"}
                      </strong>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="notice" role="status">
                    <ShieldCheck size={16} />
                    {message}
                  </div>
                )}

                <div className="queue-list">
                  {items.map((item) => {
                    const savings = item.resultBlob
                      ? Math.round(
                          ((item.file.size - item.resultBlob.size) /
                            item.file.size) *
                            100,
                        )
                      : 0;

                    return (
                      <article className="file-row" key={item.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="file-thumb"
                          src={item.resultUrl ?? item.sourceUrl}
                          alt=""
                        />
                        <div>
                          <p className="file-name" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <div className="file-meta">
                            <span>{formatBytes(item.file.size)}</span>
                            <span className="meta-separator" />
                            <span>{item.file.type.replace("image/", "").toUpperCase()}</span>
                            <StatusBadge item={item} />
                          </div>
                          {item.resultBlob && (
                            <div className="result-meta">
                              <ArrowDownToLine size={11} />
                              <span>{formatBytes(item.resultBlob.size)}</span>
                              <span
                                className={`saving ${savings < 0 ? "negative" : ""}`}
                              >
                                {savings > 0
                                  ? `${savings}% menor`
                                  : savings < 0
                                    ? `${Math.abs(savings)}% maior`
                                    : "mesmo tamanho"}
                              </span>
                              {item.resultWidth && item.resultHeight && (
                                <span>
                                  {item.resultWidth}×{item.resultHeight}
                                </span>
                              )}
                            </div>
                          )}
                          {item.error && (
                            <div className="result-meta">
                              <span className="saving negative">{item.error}</span>
                            </div>
                          )}
                        </div>
                        <div className="file-actions">
                          {item.resultBlob && item.outputName && (
                            <button
                              className="icon-button download"
                              type="button"
                              onClick={() =>
                                downloadBlob(item.resultBlob!, item.outputName!)
                              }
                              aria-label={`Baixar ${item.outputName}`}
                              title="Baixar imagem"
                            >
                              <Download size={15} />
                            </button>
                          )}
                          <button
                            className="icon-button remove-action"
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={isProcessing}
                            aria-label={`Remover ${item.file.name}`}
                            title="Remover"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              multiple
              onChange={onInputChange}
            />
          </section>

          <aside className="panel settings" aria-label="Configurações">
            <div className="settings-header">
              <h2>Configurações</h2>
              <p>Ajuste o equilíbrio entre peso e qualidade.</p>
            </div>

            <div className="setting-group">
              <div className="setting-label">Formato de saída</div>
              <div className="format-options" role="radiogroup">
                {(
                  [
                    ["webp", "WebP"],
                    ["avif", "AVIF"],
                    ["original", "Original"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={`format-option ${format === value ? "active" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={format === value}
                    onClick={() => {
                      setFormat(value);
                      if (completedItems.length) resetResults();
                    }}
                    key={value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="recommended">
                {format === "webp"
                  ? "Recomendado para compatibilidade"
                  : format === "avif"
                    ? "Maior compressão, processamento mais lento"
                    : "Mantém PNG, JPEG ou WebP"}
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-label">
                <span>Qualidade visual</span>
                <span className="setting-value">{quality}%</span>
              </div>
              <input
                className="quality-slider"
                type="range"
                min="45"
                max="100"
                value={quality}
                onChange={(event) => {
                  setQuality(Number(event.target.value));
                  if (completedItems.length) resetResults();
                }}
                aria-label="Qualidade visual"
              />
              <div className="quality-labels">
                <span>Arquivo menor</span>
                <span>Mais qualidade</span>
              </div>
              {format === "original" && items.some((item) => item.file.type === "image/png") && (
                <p className="setting-note">
                  PNG é otimizado sem perda. O controle afeta apenas JPEG e WebP.
                </p>
              )}
            </div>

            <div className="setting-group">
              <div className="setting-label">
                <span>Largura máxima</span>
                <Maximize2 size={14} />
              </div>
              <select
                className="size-select"
                value={maxWidth}
                onChange={(event) => {
                  setMaxWidth(Number(event.target.value));
                  if (completedItems.length) resetResults();
                }}
                aria-label="Largura máxima"
              >
                <option value="0">Manter tamanho original</option>
                <option value="2560">2560 px · telas grandes</option>
                <option value="1920">1920 px · banner/hero</option>
                <option value="1440">1440 px · conteúdo amplo</option>
                <option value="1080">1080 px · posts e cards</option>
                <option value="800">800 px · conteúdo compacto</option>
              </select>
              <p className="setting-note">
                A altura é ajustada proporcionalmente. Imagens menores nunca são
                ampliadas.
              </p>
            </div>

            <div className="settings-actions">
              {isProcessing && (
                <div className="progress-wrap" aria-live="polite">
                  <div className="progress-copy">
                    <span>Processando no seu dispositivo</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-bar"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                className="primary-button"
                type="button"
                onClick={completedItems.length ? downloadAll : processAll}
                disabled={!items.length || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <LoaderCircle className="spin" size={17} />
                    Otimizando...
                  </>
                ) : completedItems.length ? (
                  <>
                    <FileArchive size={17} />
                    {completedItems.length === 1
                      ? "Baixar imagem"
                      : `Baixar ${completedItems.length} em ZIP`}
                  </>
                ) : (
                  <>
                    <Zap size={17} />
                    Otimizar para {formatLabel}
                  </>
                )}
              </button>

              {completedItems.length > 0 && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={resetResults}
                >
                  <RefreshCcw size={14} />
                  Ajustar e converter novamente
                </button>
              )}
            </div>
          </aside>
        </div>

        <footer className="footer">
          <span>
            Ideal para WordPress, Framer, Webflow, Shopify e sites sob medida.
          </span>
          <div className="footer-formats" aria-label="Formatos suportados">
            <span>AVIF</span>
            <span>WEBP</span>
            <span>PNG</span>
            <span>JPEG</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
