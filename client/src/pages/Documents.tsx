import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  FileText, Upload, Download, Eye, Trash2, Plus,
  Globe, Folder, RefreshCw, X, AlertCircle, FileCode,
  FileImage, FileSpreadsheet, Check
} from 'lucide-react';
import { cn } from '../utils/cn';
import { documentService } from '../services/document.service';
import { projectService } from '../services/project.service';

interface DocumentItem {
  id: string;
  title: string;
  content: string | null;
  projectId: string | null;
  userId: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

export const Documents: React.FC = () => {
  const currentUser = useSelector((s: any) => s.auth.user);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'global' | 'project'>('all');
  
  // Filtering & Selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ingestion Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [destSpace, setDestSpace] = useState<'global' | 'project'>('global');
  const [ingestProjectId, setIngestProjectId] = useState('');
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestError, setIngestError] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

  // Preview Drawer
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [textPreviewContent, setTextPreviewContent] = useState<string>('');
  const [loadingTextContent, setLoadingTextContent] = useState<boolean>(false);

  const isTextFile = (doc: DocumentItem) => {
    if (!doc.mimeType) return false;
    return (
      doc.mimeType.startsWith('text/') ||
      doc.mimeType.includes('json') ||
      doc.mimeType.includes('javascript') ||
      doc.mimeType.includes('typescript') ||
      doc.mimeType.includes('xml') ||
      (doc.fileName ? /\.(txt|csv|json|js|ts|tsx|jsx|py|html|css|sh|md|yaml|yml)$/i.test(doc.fileName) : false)
    );
  };

  const downloadTextDoc = (doc: DocumentItem) => {
    if (!doc.content) return;
    const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${doc.title.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = (doc: DocumentItem) => {
    const token = localStorage.getItem('pv_token');
    const downloadUrl = `${BACKEND_URL}/api/documents/download/${doc.id}?token=${token}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', doc.fileName || doc.title);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadDoc = (doc: DocumentItem) => {
    if (!doc.fileUrl) {
      downloadTextDoc(doc);
    } else {
      handleDownload(doc);
    }
  };

  useEffect(() => {
    if (previewDoc && previewDoc.fileUrl) {
      if (isTextFile(previewDoc)) {
        setLoadingTextContent(true);
        setTextPreviewContent('');
        fetch(`${BACKEND_URL}${previewDoc.fileUrl}`)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to load file');
            return res.text();
          })
          .then((text) => {
            setTextPreviewContent(text);
          })
          .catch((err) => {
            console.error(err);
            setTextPreviewContent('Failed to load text file content preview.');
          })
          .finally(() => {
            setLoadingTextContent(false);
          });
      }
    } else {
      setTextPreviewContent('');
    }
  }, [previewDoc]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs);
      const projs = await projectService.getActiveProjects();
      setProjects(projs);
    } catch (err) {
      console.error('Failed to load documents page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const filterProj = activeTab === 'global' ? 'global' : (activeTab === 'project' && selectedProjectId ? selectedProjectId : undefined);
      const docs = await documentService.getDocuments(filterProj);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update list when tabs or project filters change
  useEffect(() => {
    const loadFiltered = async () => {
      setLoading(true);
      try {
        const filterProj = activeTab === 'global' ? 'global' : (activeTab === 'project' && selectedProjectId ? selectedProjectId : undefined);
        const docs = await documentService.getDocuments(filterProj);
        setDocuments(docs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (!loading) {
      loadFiltered();
    }
  }, [activeTab, selectedProjectId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIngestFile(file);
      if (!ingestTitle) {
        setIngestTitle(file.name);
      }
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestError('');
    
    if (!ingestTitle.trim()) {
      setIngestError('Title is required.');
      return;
    }

    if (destSpace === 'project' && !ingestProjectId) {
      setIngestError('Please select a project.');
      return;
    }

    if (docType === 'file' && !ingestFile) {
      setIngestError('Please select a file to upload.');
      return;
    }

    setIngesting(true);
    const targetProjId = destSpace === 'global' ? 'global' : ingestProjectId;

    try {
      let newDoc;
      if (docType === 'file' && ingestFile) {
        newDoc = await documentService.uploadDocument(ingestFile, ingestTitle, targetProjId);
      } else {
        newDoc = await documentService.createDocument(ingestTitle, ingestContent, targetProjId);
      }
      setDocuments((prev) => [newDoc, ...prev]);
      
      // Reset & close
      setModalOpen(false);
      setIngestTitle('');
      setIngestContent('');
      setIngestFile(null);
      setIngestProjectId('');
      setDestSpace('global');
      setDocType('text');
    } catch (err: any) {
      setIngestError(err.response?.data?.message || 'Failed to ingest document.');
    } finally {
      setIngesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await documentService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (previewDoc?.id === id) setPreviewDoc(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete document.');
    }
  };


  const getFileIcon = (mime: string | null) => {
    if (!mime) return FileText;
    if (mime.includes('image')) return FileImage;
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
    if (mime.includes('code') || mime.includes('javascript') || mime.includes('typescript') || mime.includes('json')) return FileCode;
    return FileText;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };



  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store, view, and organize file assets globally or project-wise.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors shadow-md"
          >
            <Plus className="h-4 w-4" /> Ingest Document
          </button>
        </div>
      </div>

      {/* Tabs & Project filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-px">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            All Docs
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeTab === 'global'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Global Space
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeTab === 'project'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Project-Wise
          </button>
        </div>

        {activeTab === 'project' && (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full sm:w-64 px-3 py-1.5 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-card p-16 text-center flex flex-col items-center justify-center gap-4">
          <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FileText className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-semibold text-foreground">No documents found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Ingest your first document or upload project assets using the "Ingest Document" button.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => {
            const isFile = !!doc.fileUrl;
            const DocIcon = isFile ? getFileIcon(doc.mimeType) : FileText;
            const isCreator = doc.userId === currentUser?.id;
            const isAdmin = currentUser?.role === 'ADMIN';

            return (
              <div
                key={doc.id}
                className="group relative rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-md hover:border-border/80 transition-all"
              >
                {/* File Metadata Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                      isFile ? 'bg-info/10 text-info border-info/10' : 'bg-primary/10 text-primary border-primary/10'
                    )}>
                      <DocIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors" title={doc.title}>
                        {doc.title}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        by {doc.user.fullName}
                      </p>
                    </div>
                  </div>

                  {/* Badges / Space identifiers */}
                  <span className={cn(
                    'text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full border shrink-0',
                    doc.projectId 
                      ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                      : 'text-sky-500 bg-sky-500/10 border-sky-500/20'
                  )}>
                    {doc.project ? doc.project.name : 'Global'}
                  </span>
                </div>

                {/* Content description for visual preview */}
                <div className="flex-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {isFile ? (
                    <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-muted/40 font-mono text-[10px]">
                      <div>Name: {doc.fileName}</div>
                      <div>Type: {doc.mimeType}</div>
                      <div>Size: {formatSize(doc.fileSize)}</div>
                    </div>
                  ) : (
                    doc.content || 'Empty text document.'
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {/* Inline view */}
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      title="View Document"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Download */}
                    <button
                      onClick={() => downloadDoc(doc)}
                      title={isFile ? "Download File" : "Download TXT"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    {(isCreator || isAdmin) && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        title="Delete Document"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-card hover:bg-rose-500/10 text-rose-500 hover:border-rose-500/40 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- Ingestion Modal Popup --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" /> Ingest New Document
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleIngest} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {ingestError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 flex items-start gap-2 text-rose-500 text-xs leading-normal">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{ingestError}</span>
                </div>
              )}

              {/* Document Type Selector */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Ingestion Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setDocType('text'); setIngestFile(null); }}
                    className={cn(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-colors',
                      docType === 'text'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    )}
                  >
                    Rich Text Creator
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDocType('file'); setIngestContent(''); }}
                    className={cn(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-colors',
                      docType === 'file'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    )}
                  >
                    Upload Asset File
                  </button>
                </div>
              </div>

              {/* Destination Selector */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Associated Space
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestSpace('global')}
                    className={cn(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5',
                      destSpace === 'global'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" /> Global Space
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestSpace('project')}
                    className={cn(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5',
                      destSpace === 'project'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    )}
                  >
                    <Folder className="h-3.5 w-3.5" /> Project-Wise
                  </button>
                </div>
              </div>

              {/* Project Dropdown selection (conditional) */}
              {destSpace === 'project' && (
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Select Target Project
                  </label>
                  <select
                    value={ingestProjectId}
                    onChange={(e) => setIngestProjectId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Common Details */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Document Title
                </label>
                <input
                  type="text"
                  value={ingestTitle}
                  onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder="e.g. API Specification docs"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Rich Text Editor mode */}
              {docType === 'text' && (
                <div className="flex-1 flex flex-col min-h-[140px]">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Markdown Content
                  </label>
                  <textarea
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    placeholder="Write or paste your markdown contents here..."
                    className="w-full flex-1 px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono min-h-[120px]"
                  />
                </div>
              )}

              {/* File Upload Mode */}
              {docType === 'file' && (
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    File Attachment
                  </label>
                  <div className="rounded-xl border border-border border-dashed bg-muted/20 hover:bg-muted/40 transition-colors p-6 flex flex-col items-center justify-center text-center cursor-pointer relative">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    {ingestFile ? (
                      <div>
                        <p className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                          {ingestFile.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatSize(ingestFile.size)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-foreground font-semibold">
                          Click or drag file here
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Supports PDFs, Images, TXT, Excel up to 10MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-border/60 pt-4 mt-2 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors flex items-center gap-1.5"
                >
                  {ingesting ? (
                    <><RefreshCw className="h-3 w-3 animate-spin" /> Ingesting...</>
                  ) : (
                    'Ingest Document'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Online Preview Drawer --- */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col animate-slide-in shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground truncate" title={previewDoc.title}>
                    {previewDoc.title}
                  </h2>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20 shrink-0">
                    {previewDoc.project ? previewDoc.project.name : 'Global Space'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Created by {previewDoc.user.fullName} on {new Date(previewDoc.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document Content / Viewer */}
            {!previewDoc.fileUrl ? (
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-foreground bg-muted/20 leading-relaxed whitespace-pre-wrap select-text">
                {previewDoc.content || (
                  <span className="text-muted-foreground italic">This document has no content.</span>
                )}
              </div>
            ) : previewDoc.mimeType?.startsWith('image/') ? (
              <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-muted/25">
                <img
                  src={`${BACKEND_URL}${previewDoc.fileUrl}`}
                  alt={previewDoc.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md border border-border"
                />
              </div>
            ) : previewDoc.mimeType === 'application/pdf' ? (
              <div className="flex-1 overflow-y-auto p-2 bg-muted/10">
                <object
                  data={`${BACKEND_URL}${previewDoc.fileUrl}`}
                  type="application/pdf"
                  className="w-full h-full min-h-[600px] rounded-lg border border-border bg-card"
                >
                  <iframe
                    src={`${BACKEND_URL}${previewDoc.fileUrl}`}
                    className="w-full h-full border-none"
                    title={previewDoc.title}
                  />
                </object>
              </div>
            ) : isTextFile(previewDoc) ? (
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-foreground bg-muted/20 leading-relaxed whitespace-pre select-text">
                {loadingTextContent ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading file content...
                  </div>
                ) : (
                  textPreviewContent || <span className="text-muted-foreground italic">Empty file.</span>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                <div className="flex flex-col items-center justify-center text-center p-8 bg-card border border-border border-dashed rounded-xl max-w-md shadow-sm">
                  <span className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
                    {React.createElement(getFileIcon(previewDoc.mimeType), { className: "h-8 w-8" })}
                  </span>
                  <h3 className="font-bold text-foreground text-sm truncate max-w-xs">{previewDoc.fileName || previewDoc.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    No online preview is available for this file type ({previewDoc.mimeType || 'unknown'}). Please download the file to view it locally.
                  </p>
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="mt-6 flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors shadow-md"
                  >
                    <Download className="h-4 w-4" /> Download File ({formatSize(previewDoc.fileSize)})
                  </button>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-border shrink-0 bg-card flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Document ID: {previewDoc.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadDoc(previewDoc)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" /> {previewDoc.fileUrl ? 'Download File' : 'Download TXT'}
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
