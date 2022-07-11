
import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	EditorPosition,
} from "obsidian";

interface LanguageTranslatorSettings {
	defaultLanguage: string;
}

const DEFAULT_SETTINGS: LanguageTranslatorSettings = {
	defaultLanguage: "Microsoft David - English (United States)"
};


async function getNextAudio(sentence: string, code: string) {
	console.log(sentence);
	let voice = speechSynthesis.getVoices().find(v => v.name == code);

	let audio = new SpeechSynthesisUtterance(sentence);
	let englishCharsCount = Array.from(sentence).map(c => (c.match(/[a-zA-Z]/) ? 1 : 0));
	let englishCharsSum = englishCharsCount.reduce(function (sum, cur) { return sum + cur }, 0);
	if (englishCharsSum / sentence.length > 0.65) {
		voice = speechSynthesis.getVoices().find(v => v.lang == "en-US");
	}
	if (voice) {
		audio.lang = voice.lang;
		audio.voice = voice;
	}
	window.speechSynthesis.speak(audio);

	return new Promise(resolve => {
		audio.onend = resolve;
	});
}

export default class LanguageTranslator extends Plugin {
	settings: LanguageTranslatorSettings;
	token: string;
	instance: SpeechSynthesisUtterance;
	speaking: boolean = false;
	cursor: EditorPosition | null = null;

	// cleanup text
	cleanUpText = (text: string) => {
		let res = text.replace(/\[([^\[\]]*)\]\((.*?)\)/gm, '$1');
		//remove # from the beginning of the line
		res = res.replace(/^#/gm, '');
		//remove http url from text
		res = res.replace(/\(http(.*?)\)/gm, '');
		//remove markdown images from text
		res = res.replace(/!\[(.*?)\]\((.*?)\)/gm, '').replace(/!\[\[(.*?)\]\]/gm, '');
		return res;
	}

	// Speech from current line
	SpeechFromCurrentLine = async (editor: Editor) => {
		this.cursor = editor.getCursor();
		this.StartSpeech(editor);
	}

	StartSpeech = async (editor: Editor) => {
		try {
			let selection = editor.getSelection();
			let cursor = editor.getCursor();

			// if no selection, use the whole text
			if (selection.length === 0) {
				if (this.cursor) {
					let lastLine = editor.getLine(editor.lastLine());
					let endEndCursor = { line: editor.lastLine(), ch: lastLine.length };
					selection = editor.getRange(this.cursor, endEndCursor);
					cursor = this.cursor;
				} else {
					selection = editor.getValue();
					cursor = { line: 0, ch: 0 };
				}
			}

			let lines = selection.split('\n');
			this.speaking = true;

			//try to fix cursor
			if (lines.length > 0) {
				let line = lines[0];
				let allLine = editor.getLine(cursor.line);
				let cursorLine = editor.getRange(cursor, { line: cursor.line, ch: allLine.length }).replace(/\n/g, '');
				if (line != cursorLine) {
					//means cursor is at the end of selection, try to fix it.
					cursor = { line: cursor.line - lines.length + 1, ch: 0 };
				}
			}

			for (let i = 0; i < lines.length; i++) {
				if (!this.speaking) {
					continue;
				}
				let textForSpeech = lines[i];


				//if the line is all English words, set code to en
				textForSpeech = this.cleanUpText(textForSpeech);


				let nextCursor = {
					line: cursor.line + i,
					ch: 0,
				};
				editor.setCursor(nextCursor);
				await getNextAudio(textForSpeech, this.settings.defaultLanguage);

				this.cursor = null;
			};
		} catch (err) {
			console.log(err);
			new Notice(err.message);
		}
	};

	onCancelCallback = async (editor: Editor) => {
		console.log("cancel speak");
		this.speaking = false;
		window.speechSynthesis.cancel();
	}

	async onload() {
		await this.loadSettings();
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "editor-say-it-start-command",
			name: "Speech: Speech the text",
			editorCallback: this.StartSpeech,
			hotkeys: [
				{
					modifiers: ["Ctrl", "Shift"],
					key: "P",
				},
			],
		});

		this.addCommand({
			id: "editor-say-it-start-from-current-pos-command",
			name: "Speech: Speech the text from current pos",
			editorCallback: this.SpeechFromCurrentLine,
			hotkeys: [
				{
					modifiers: ["Ctrl", "Shift"],
					key: "C",
				},
			],
		});

		this.addCommand({
			id: "editor-say-it-stop-command",
			name: "Speech: Cancel ongoin speech",
			editorCallback: this.onCancelCallback,
			hotkeys: [
				{
					modifiers: ["Ctrl", "Shift"],
					key: "T",
				},
			],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LanguageTranslatorSettingsTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class LanguageTranslatorSettingsTab extends PluginSettingTab {
	plugin: LanguageTranslator;
	allLanguages: string[];

	constructor(app: App, plugin: LanguageTranslator) {
		super(app, plugin);
		this.plugin = plugin;
		this.allLanguages = [
			'Microsoft David - English (United States)',
			'Microsoft Mark - English (United States)',
			'Microsoft Zira - English (United States)',
			'Microsoft Huihui - Chinese (Simplified, PRC)',
			'Microsoft Kangkang - Chinese (Simplified, PRC)',
			'Microsoft Yaoyao - Chinese (Simplified, PRC)']
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "SayIt Settings" });

		new Setting(containerEl)
			.setName("Default Language")
			.setDesc("Set default language for speak out")
			.addDropdown((dropDown) => {
				console.log(this.allLanguages);
				this.allLanguages.forEach((el) => {
					dropDown.addOption(el, el);
				});
				dropDown.onChange(async (value) => {
					this.plugin.settings.defaultLanguage = value;
					await this.plugin.saveSettings();
				});
				dropDown.setValue(this.plugin.settings.defaultLanguage);
			});
	}
}