---
description: Push code to the official BAS-SOFTWARE repository
---

This workflow ensures code is pushed to the correct repository: https://github.com/wasidevxyz-pixel/BAS-SOFTWARE.git

1. Verify remote origin is set to https://github.com/wasidevxyz-pixel/BAS-SOFTWARE.git
   ```powershell
   git remote get-url origin
   # Output should be: https://github.com/wasidevxyz-pixel/BAS-SOFTWARE.git
   ```

2. Push current branch to origin
   ```powershell
   git push origin HEAD
   ```
