
import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";


import LanguageCode from "./langCode";
import langCodes from "./langCodes";

const TRANSLATE_API_URL = "https://api.cognitive.microsofttranslator.com";
const AUTH_URL =
	"https://func-language-worker-auth.azurewebsites.net/api/GetAuthToken";
const MAX_CHARACTERS = 1000;

interface LanguageTranslatorSettings {
    defaultLanguage: LanguageCode;
}

const DEFAULT_SETTINGS: LanguageTranslatorSettings = {
    defaultLanguage: {
		text: "English",
		code: "en",
	}
};

export default class LanguageTranslator extends Plugin {
	settings: LanguageTranslatorSettings;
	token: string;
    instance: SpeechSynthesisUtterance;

	onEditorCallback = async (editor: Editor) => {
		try {
			const selection = editor.getSelection();
			if (selection.length > MAX_CHARACTERS) {
				new Notice(`Exceeded ${MAX_CHARACTERS} max characters!`);
				return;
			}

			let textForSpeech = selection;
			let targetLang = this.settings.defaultLanguage.code;
            console.log("textForTranslation: {}", textForSpeech);
            var msg = new SpeechSynthesisUtterance();
            msg.text = textForSpeech;
            msg.lang = this.settings.defaultLanguage.code;
            window.speechSynthesis.speak(msg);
		} catch (err) {
			console.log(err);
			new Notice(err.message);
		}
	};

    onCancelCallback = async (editor: Editor) => {
        window.speechSynthesis.cancel();
    }

	getToken = async () => {
		try {
			const response = await fetch(AUTH_URL);
			this.token = await response.text();
		} catch (err) {
			console.log(err);
			new Notice(err.message);
		}
	};

	async onload() {
		await this.loadSettings();
		await this.getToken();
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "editor-say-it-start-command",
			name: "Speak out the text",
			editorCallback: this.onEditorCallback,
			hotkeys: [
				{
					modifiers: ["Ctrl", "Shift"],
					key: "P",
				},
			],
		});

        this.addCommand({
			id: "editor-say-it-stop-command",
			name: "Cancel speak",
			editorCallback: this.onEditorCallback,
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

	constructor(app: App, plugin: LanguageTranslator) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "SayIt Settings" });

		new Setting(containerEl)
			.setName("Default Language")
			.setDesc("Set default language for speak out")
			.addDropdown((dropDown) => {
				langCodes.forEach((el) => {
					dropDown.addOption(el.code, el.text);
				});
				dropDown.onChange(async (value) => {
                    var lang = langCodes.find(x => x.code == value);
                    if (lang) {
                        this.plugin.settings.defaultLanguage = lang;
                    }
					await this.plugin.saveSettings();
				});
				dropDown.setValue(this.plugin.settings.defaultLanguage.code);
			});
	}
}