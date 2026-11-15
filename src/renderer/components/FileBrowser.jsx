// src/renderer/components/FileBrowser.jsx
import React, { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, FileCode, FileText, Image as ImageIcon,
  ChevronRight, ChevronDown, Copy, Check, Eye
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTreeNode({ repoPath, item, selectedFile, onSelectFile, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleDirectory = async () => {
    if (!item.isDirectory) {
      onSelectFile(item);
      return;
    }
    if (!expanded && children.length === 0) {
      setLoading(true);
      const res = await window.api.listDir(repoPath, item.relativePath);
      if (res && res.items) {
        setChildren(res.items);
      }
      setLoading(false);
    }
    setExpanded(!expanded);
  };

  const isSelected = selectedFile?.relativePath === item.relativePath;

  return (
    <div>
      <div
        onClick={toggleDirectory}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`flex items-center gap-1.5 py-1 pr-2 cursor-pointer text-xs select-none transition rounded ${
          isSelected
            ? 'bg-[#276782]/40 text-[#ededed] font-medium border border-[#3994BC]/50'
            : 'text-[#bfbfbf] hover:bg-white/[0.06] hover:text-[#ededed]'
        }`}
      >
        {item.isDirectory ? (
          <>
            {expanded ? (
              <ChevronDown size={13} className="text-gray-400 shrink-0" />
            ) : (
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
            )}
            {expanded ? (
              <FolderOpen size={14} className="text-amber-400 shrink-0" />
            ) : (
              <Folder size={14} className="text-amber-400 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-[13px] shrink-0" />
            <FileCode size={14} className="text-blue-400 shrink-0" />
          </>
        )}
        <span className="truncate flex-1">{item.name}</span>
        {!item.isDirectory && item.size > 0 && (
          <span className="text-[10px] text-gray-500 shrink-0">{formatBytes(item.size)}</span>
        )}
      </div>

      {loading && (
        <div
          style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
          className="text-[11px] text-gray-500 py-0.5"
        >
          Loading...
        </div>
      )}

      {expanded &&
        children.map((child) => (
          <FileTreeNode
            key={child.relativePath}
            repoPath={repoPath}
            item={child}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export default function FileBrowser({ repoPath }) {
  const [rootItems, setRootItems] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load root directory when repo changes
  useEffect(() => {
    let active = true;
    setSelectedFile(null);
    setFileData(null);

    window.api.listDir(repoPath, '').then((res) => {
      if (active && res?.items) {
        setRootItems(res.items);
      }
    });

    return () => {
      active = false;
    };
  }, [repoPath]);

  const handleSelectFile = async (item) => {
    setSelectedFile(item);
    setLoadingFile(true);
    const res = await window.api.readFile(repoPath, item.relativePath);
    setFileData(res);
    setLoadingFile(false);
  };

  const handleCopyCode = () => {
    if (!fileData?.content) return;
    navigator.clipboard.writeText(fileData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const lines = fileData?.content ? fileData.content.split('\n') : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Column: Collapsible File Tree */}
      <div className="w-72 bg-[#191A1B] border-r border-[#2A2B2C] overflow-y-auto p-2 shrink-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8C8C] px-2 py-1.5 mb-1 border-b border-[#2A2B2C] flex items-center justify-between">
          <span>Repository Files</span>
          <span className="text-[10px] text-[#555555]">Read-Only</span>
        </div>
        {rootItems.map((item) => (
          <FileTreeNode
            key={item.relativePath}
            repoPath={repoPath}
            item={item}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
          />
        ))}
      </div>

      {/* Right Column: Code Peek Viewer */}
      <div className="flex-1 flex flex-col bg-[#121314] overflow-hidden">
        {selectedFile ? (
          <>
            {/* File Header Bar */}
            <div className="h-10 bg-[#191A1B] border-b border-[#2A2B2C] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs text-[#ededed] font-mono truncate">
                <Eye size={14} className="text-[#48A0C7] shrink-0" />
                <span className="truncate">{selectedFile.relativePath}</span>
                <span className="text-[#8C8C8C] text-[11px] ml-2">
                  ({formatBytes(selectedFile.size)})
                </span>
              </div>

              {fileData?.content && (
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[#242526] hover:bg-[#333536] text-[#ededed] border border-[#2A2B2C] transition"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy Raw'}
                </button>
              )}
            </div>

            {/* File Content Body */}
            <div className="flex-1 overflow-auto p-4">
              {loadingFile ? (
                <div className="text-sm text-[#8C8C8C]">Reading file...</div>
              ) : fileData?.error ? (
                <div className="text-sm text-red-400">Error: {fileData.error}</div>
              ) : fileData?.isTooLarge ? (
                <div className="p-6 bg-[#191A1B] border border-[#2A2B2C] rounded-lg text-center max-w-md mx-auto mt-10">
                  <FileText size={32} className="mx-auto mb-2 text-amber-400" />
                  <p className="text-sm text-[#ededed] font-medium">
                    File is large ({fileData.sizeKB} KB)
                  </p>
                  <p className="text-xs text-[#8C8C8C] mt-1">
                    Preview is capped at 500 KB to keep OSSVault fast. Click the "VS Code" button above to inspect this file.
                  </p>
                </div>
              ) : fileData?.isBinary ? (
                <div className="flex flex-col items-center justify-center h-full text-[#8C8C8C]">
                  {['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'].includes(
                    fileData.extension
                  ) ? (
                    <div className="text-center">
                      <img
                        src={fileData.fileUrl}
                        alt={selectedFile.name}
                        className="max-h-[65vh] max-w-full rounded border border-[#2A2B2C] mx-auto mb-3"
                      />
                      <span className="text-xs text-[#8C8C8C]">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon size={36} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Binary file ({fileData.extension})</p>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="text-xs font-mono leading-relaxed select-text">
                  <code>
                    {lines.map((line, idx) => (
                      <div key={idx} className="table-row hover:bg-white/[0.04]">
                        <span className="table-cell text-right pr-4 select-none text-[#555555] w-10">
                          {idx + 1}
                        </span>
                        <span className="table-cell text-[#bfbfbf] whitespace-pre-wrap break-all">
                          {line || ' '}
                        </span>
                      </div>
                    ))}
                  </code>
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8C8C8C]">
            <FileCode size={42} className="mb-2 opacity-25" />
            <p className="text-sm">Click any file in the left tree to peek at its source code</p>
            <p className="text-xs text-[#555555] mt-1">Strictly read-only — your repository files are never modified</p>
          </div>
        )}
      </div>
    </div>
  );
}
