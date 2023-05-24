# Notion Guardian

A tool that automatically backups your [Notion](notion.so) workspace and commits changes to another repository.

Notion Guardian offers a quick way to setup a secure backup of your data in a private repository — allowing you to track how your notes change over time and to know that your data is safe.

The tool separates the logic for running the export and the actual workspace data into two repositories. This way your backups are not cluttered with other scripts. If you prefer to have a one-repo solution or want to backup specific blocks of your workspace, checkout the [notion-backup fork by upleveled](https://github.com/upleveled/notion-backup).

## How to setup

1. Create a separate private repository for your backups to live in (e.g. "notion-backup"). Make sure you create a `main` branch — for example by clicking "Add a README file" when creating the repo.
2. Fork this repository ("notion-guardian").
3. Create a Personal Access Token ([docs](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token)) with the "repo" scope and store it as `REPO_PERSONAL_ACCESS_TOKEN` in the secrets of the forked repo.
4. Store your GitHub username in the `REPO_USERNAME` secret.
5. Store the name of your newly created private repo in the `REPO_NAME` secret (in this case "notion-backup").
6. Store the email that should be used to commit changes (usually your GitHub account email) in the `GIT_EMAIL` secret as well as your name in `GIT_USERNAME`.
7. Obtain your Notion space-id and token as described in the section below. Store it in the `NOTION_SPACE_ID` and `NOTION_TOKEN` secret.
8. You will also need to obtain your `notion_user_id` the same way and store it in a `NOTION_USER_ID` secret.
9. Click the "Actions" tab on the forked repo and enable actions by clicking the button.
10. On the left sidebar click the "Backup Notion Workspace" workflow. A notice will tell you that "Scheduled Actions" are disabled, so go ahead and click the button to enable them.
11. Wait until the action runs for the first time or push a commit to the repo to trigger the first backup.
12. Check your private repo to see that an automatic commit with your Notion workspace data has been made. Done 🙌

## Get your Notion space-id and token

Automatically downloading backups from Notion requires two unique authentication tokens and your individual space ID which must be obtained for the script to work.

1. Log into your Notion account in your browser of choice.
2. Open a new tab in your browser and open the development tools. This is usually easiest done by right-click and selecting `Inspect Element` (Chrome, Edge, Safari) or `Inspect` (Firefox). Switch to the Network tab.
3. Open https://notion.so/.
4. Insert `getSpaces` into the search filter of the Network tab. This should give you one result. Click on it.
5. In the Preview or Response tab, look for the key `space`. There you should find a list of all the workspaces you have access to. Unless you're part of shared workspaces there should only be one.
6. Copy the UUID of the workspace you want to backup (e.g. `6e560115-7a65-4f65-bb04-1825b43748f1`). This is your `NOTION_SPACE_ID`.
7. Look for the key `notion_user`. This is your `NOTION_USER_ID`.
8. Switch to the Application (Chrome, Edge) or Storage (Firefox, Safari) tab on the top.
9. In the left sidebar, select `Cookies` -> `https://www.notion.so` (Chrome, Edge, Firefox) or `Cookies – https://www.notion.so` (Safari).
10. Copy the value of `token_v2` as your `NOTION_TOKEN`.
11. Set the three environment variables as secrets for actions in your GitHub repository.

**NOTE**: if you log out of your account or your session expires naturally, the `NOTION_TOKEN` will get invalidated and the backup will fail. In this case you need to obtain new tokens by repeating this process. There is currently no practical way to automize this until Notion decides to add a backup endpoint to their official API, at which point this script will be able to use a proper authentication token.

## How it works

This repo contains a GitHub workflow that runs every day and for every push to this repo. The workflow will execute the script which makes an export request to Notion, waits for it to finish and downloads the workspace content to a temporary directory. The workflow will then commit this directory to the repository configured in the repo secrets.

## Running manually

```console
npm i
NOTION_SPACE_ID=xxx NOTION_USER_ID=xxx NOTION_TOKEN=xxx node index.js
```