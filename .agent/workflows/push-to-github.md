---
description: Push code to the official BAS-SOFTWARE repository
---

This workflow ensures that code is pushed to the correct repository: `https://github.com/wasidevxyz-pixel/BAS-SOFTWARE.git`.

1. **Verify Remote**: Ensure the `origin` remote is set to `https://github.com/wasidevxyz-pixel/BAS-SOFTWARE.git`.
   ```powershell
   git remote set-url origin https://github.com/wasidevxyz-pixel/BAS-SOFTWARE.git
   ```

2. **Stage Changes**:
   ```powershell
   git add .
   ```

3. **Commit Changes**:
   ```powershell
   git commit -m "Update from Antigravity: [Descriptive Message]"
   ```

4. **Push to GitHub**:
   ```powershell
   git push origin main
   ```
