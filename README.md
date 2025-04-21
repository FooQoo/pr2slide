# pr2slide

pr2slide is a Visual Studio Code extension that helps you generate slide decks from GitHub pull requests using OpenAI's language models. It fetches pull request diffs and repository README files, then generates Markdown slides compatible with Marp.

## Features

- Browse and select pull requests from your GitHub repository.
- Automatically fetch pull request diffs and repository README.
- Generate slide decks in Markdown format using OpenAI.
- Preview generated slides within VS Code using the Markdown preview.
- Securely store your GitHub and OpenAI API tokens using VS Code's SecretStorage.

## Setup

1. **Install the extension**  
   Install pr2slide from the VS Code Marketplace or by loading it from source.

2. **Configure API tokens**  
   - Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
   - Run `pr2slide.setGitHubToken` and enter your GitHub Personal Access Token.
   - Run `pr2slide.setOpenAIApiKey` and enter your OpenAI API key.

3. **Open a GitHub repository in VS Code**  
   Make sure your workspace is opened on a folder linked to a GitHub repository.

4. **Generate slides from a pull request**  
   - Run the command `pr2slide.generateSlide`.
   - Select a pull request from the list.
   - Wait while the extension fetches data and generates slides.
   - The generated slides will open in a Markdown editor with a preview pane.

## Usage

- Use the "Load more..." option to fetch additional pull requests if you have many.
- The generated slides are Markdown files compatible with [Marp](https://marp.app/), allowing you to further edit and customize them.

## Requirements

- VS Code with Git and Marp extension enabled.
- GitHub repository opened in your workspace.
- Valid GitHub Personal Access Token with permissions to read pull requests.
- Valid OpenAI API key.

## License

MIT License