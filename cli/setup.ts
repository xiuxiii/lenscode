/**
 * Instructions printed by `lens --setup-mac` and `lens --setup-zsh`.
 *
 * Shortcuts and Services do not load your shell's PATH, so the commands they
 * run name Node and the bundled CLI by their full paths.
 */

export interface LensPaths {
  /** The Node binary (`process.execPath`). */
  node: string
  /** The bundled CLI, `dist-cli/lens.mjs`. */
  script: string
}

/** `value` as one word for zsh or bash, quoted only when it needs to be. */
export function shellQuote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`
}

/** The full command that runs `lens`, for places without your PATH. */
export function lensCommand({ node, script }: LensPaths): string {
  return `${shellQuote(node)} ${shellQuote(script)}`
}

export function setupMacText(paths: LensPaths): string {
  const command = lensCommand(paths)
  return `Explain highlighted text with a keyboard shortcut on your Mac

This uses the Shortcuts app and works in Terminal and many other Mac apps.
Highlight some text, press the shortcut, and the explanation pops up. The text
is only explained, never run.

1. Open the Shortcuts app and make a new shortcut (File > New Shortcut).
   Name it "Explain with LensCode".

2. Click the Shortcut Details button (the "i" at the top right), then tick
   "Use as Quick Action" and "Services Menu".

3. At the top of the shortcut, make it receive only "Text" input from
   "Quick Actions".

4. Add a "Run Shell Script" action. Set Shell to "zsh", Input to "Shortcut
   Input" and Pass Input to "to stdin", then paste this as the script:

   ${command} --popup

   (To read the explanation in LensCode in your browser instead, end it with
   --open. That needs LensCode running: npm run dev.)

5. In Shortcuts > Settings > Advanced, turn on "Allow Running Scripts".

6. Try it: highlight a command in Terminal, then choose
   Terminal > Services > Explain with LensCode.

7. Give it a keyboard shortcut: System Settings > Keyboard > Keyboard
   Shortcuts… > Services. Under "Text", find "Explain with LensCode",
   double-click "none" and press the keys, for example Control-Option-Command-L.

If no dialog appears, use --open instead of --popup. If you move the LensCode
folder or remove this version of Node, run lens --setup-mac again.
`
}

export function setupZshText(paths: LensPaths): string {
  return `# LensCode: press Ctrl+X then Ctrl+L to explain the command you are typing.
# The command is only explained, never run, and stays on the line to edit or run.
# Add this to ~/.zshrc (lens --setup-zsh >> ~/.zshrc), then open a new terminal.
lens-explain-line() {
  [[ -n \${BUFFER//[[:space:]]/} ]] || return 0
  zle -I
  print -rn -- "$BUFFER" | ${lensCommand(paths)}
}
zle -N lens-explain-line
bindkey '^X^L' lens-explain-line
`
}
