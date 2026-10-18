import { useMemo, useState } from 'react'
import type { WorkspaceFile } from '../../types/workspace'
import { ChevronRightIcon, FileIcon, FolderIcon } from '../icons'

interface FolderNode {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

interface FileNode {
  kind: 'file'
  file: WorkspaceFile
}

type TreeNode = FolderNode | FileNode

/** Nest files by their '/'-separated paths. Folders sort first, by name. */
function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: FolderNode = { kind: 'folder', name: '', path: '', children: [] }
  const folders = new Map<string, FolderNode>([['', root]])
  for (const file of files) {
    const parts = file.path.split('/')
    let parent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join('/')
      let folder = folders.get(path)
      if (!folder) {
        folder = { kind: 'folder', name: parts[i], path, children: [] }
        folders.set(path, folder)
        parent.children.push(folder)
      }
      parent = folder
    }
    parent.children.push({ kind: 'file', file })
  }
  const sort = (nodes: TreeNode[]) => {
    // Folders first (alphabetical); files keep their order, which is already
    // alphabetical for opened folders and curated for the starter files.
    nodes.sort((a, b) =>
      a.kind === b.kind
        ? a.kind === 'folder'
          ? a.name.localeCompare((b as FolderNode).name)
          : 0
        : a.kind === 'folder'
          ? -1
          : 1,
    )
    for (const n of nodes) if (n.kind === 'folder') sort(n.children)
  }
  sort(root.children)
  return root.children
}

/** Per level: the chevron (16) plus its gap (4), so a child's icon sits under its folder's icon. */
const INDENT = 20
const ROW_PADDING = 8

interface FileTreeProps {
  files: WorkspaceFile[]
  activeFile: WorkspaceFile
  onSelectFile: (id: string) => void
}

export function FileTree({ files, activeFile, onSelectFile }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files])
  // Folders the user has explicitly opened or closed. Anything else is open
  // only when it contains the active file.
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map())

  const isOpen = (folder: FolderNode) =>
    toggled.get(folder.path) ?? activeFile.path.startsWith(`${folder.path}/`)

  const toggle = (folder: FolderNode) =>
    setToggled((prev) => new Map(prev).set(folder.path, !isOpen(folder)))

  const render = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indent = { paddingLeft: ROW_PADDING + depth * INDENT }
      if (node.kind === 'folder') {
        const open = isOpen(node)
        return (
          <li key={`d:${node.path}`}>
            <button
              type="button"
              className="file-tree__row"
              style={indent}
              onClick={() => toggle(node)}
              aria-expanded={open}
              title={node.path}
            >
              <ChevronRightIcon
                className={`file-tree__chevron${open ? ' file-tree__chevron--open' : ''}`}
              />
              <FolderIcon className="file-tree__icon" />
              <span className="file-tree__name">{node.name}</span>
            </button>
            {open && <ul className="file-tree">{render(node.children, depth + 1)}</ul>}
          </li>
        )
      }
      const { file } = node
      const active = file.id === activeFile.id
      return (
        <li key={file.id}>
          <button
            type="button"
            className={`file-tree__row${active ? ' file-tree__row--active' : ''}`}
            style={indent}
            onClick={() => onSelectFile(file.id)}
            aria-current={active ? 'true' : undefined}
            title={file.path}
          >
            <FileIcon className="file-tree__icon" />
            <span className="file-tree__name">{file.name}</span>
          </button>
        </li>
      )
    })

  return <ul className="file-tree">{render(tree, 0)}</ul>
}
