# Put Cyber Runner on GitHub

This folder is initialized as a local Git repository on branch `main`.
No remote repository is created by the preparation step.

## GitHub Desktop

1. Choose **File → Add local repository** and select this project folder.
2. Review the files. Source, documentation, tests, floor maps and offline runtime
   files should appear. Characters, backups, `work/`, `outputs/` and archives should not.
3. Create the first commit, for example `Prepare Cyber Runner`.
4. Choose **Publish repository**, name it `cyber-runner`, select the intended
   visibility and publish when ready.

Do not force-add ignored Mixamo files to a public repository. See
[asset setup](ASSET-SETUP.md). The original project currently has no open-source
reuse license; choose one deliberately if you want to grant reuse rights.

## Terminal

```sh
npm run check
npm run assets:check:public
npm test
git status --short
git add .
git diff --cached --stat
git commit -m "Prepare Cyber Runner"
```

Create an **empty** GitHub repository without another README, `.gitignore` or
license. Then use its real HTTPS or SSH clone URL:

```sh
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the URL GitHub gives you. Use normal
GitHub sign-in tools; never put access tokens in source files or commits.

## Included and excluded files

Local JavaScript, WASM and the Full pose model are included to preserve offline
operation. Individual included files are below GitHub's regular Git file-size
limit, so this version does not require Git LFS. See
[GitHub's file-size guidance](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

A fresh clone needs the separate local character described in
[ASSET-SETUP.md](ASSET-SETUP.md). Keep a private backup of the full exhibition
folder; a public source archive excludes that character. Publishing source does
not deploy the game to GitHub Pages. The documented launch method is the local
Node.js server.
