import axios from "axios"
import crypto from "crypto"
import querystring from "node:querystring"
import {Color, getPreferenceValues, Icon} from "@raycast/api"
import {COPY_TYPE, LANGUAGE_LIST} from "./consts"

import {
    ILanguageListItem,
    IPreferences,
    IReformatTranslateResult,
    ITranslateReformatResult,
    ITranslateResult,
} from "./types"
import qs from "querystring";

export function truncate(string: string, length = 16, separator = "..") {
    if (string.length <= length) return string

    return string.substring(0, length) + separator
}

export function getItemFromLanguageList(value: string): ILanguageListItem {
    for (const langItem of LANGUAGE_LIST) {
        if (langItem.languageId === value) {
            return langItem
        }
    }

    return {
        languageId: "",
        languageTitle: "",
        languageVoice: [""],
    }
}

export function reformatCopyTextArray(data: string[], limitResultAmount = 10): IReformatTranslateResult[] {
    const dataLength = data?.length - 1
    let finalData: string[] = data
    if (limitResultAmount > 0 && dataLength >= limitResultAmount) {
        finalData = data.slice(0, limitResultAmount - 1)
        finalData.push(data[dataLength])
    }
    const finalDataLength = finalData.length - 1
    return finalData.map((text, idx) => {
        return {
            title: finalDataLength === idx && idx > 0 ? "All" : truncate(text),
            value: text,
        }
    })
}

export function reformatTranslateResult(data: ITranslateResult): ITranslateReformatResult[] {
    const reformatData: ITranslateReformatResult[] = []
    console.log(JSON.stringify(data))

    reformatData.push({
        type: "Translate",
        hint: "翻译",
        lang: defineLanguage(data.l),
        children: data.translation?.map((text, idx) => {
            return {
                title: text,
                key: text + idx,
                icon: Icon.Text,
                phonetic: data.basic?.phonetic ? "[" + data.basic?.phonetic + "]" : "",
                color: Color.Magenta
            }
        }),
    })

    // Delete repeated text item
    // 在有道结果中 Translation 目前观测虽然是数组，但只会返回length为1的结果，而且重复只是和explains[0]。
    if (data.basic?.explains && data?.translation) {
        data.basic?.explains[0] === data?.translation[0] && data.basic.explains.shift()
    }

    if (data.basic?.["us-phonetic"] && (data.basic?.["uk-phonetic"])) {
        reformatData.push({
            type: "Phonetic",
            hint: "音标",
            children: data.translation?.map((text, idx) => {
                return {
                    title: data.basic?.["uk-phonetic"] + "",
                    key: text + idx,
                    icon: Icon.Message,
                    color: Color.Blue,
                    accessoryTitle: "英国",
                }
            }),
        });
        reformatData.push({
            children: data.translation?.map((text, idx) => {
                return {
                    title: data.basic?.["us-phonetic"] + "",
                    key: text + idx,
                    icon: Icon.Message,
                    color: Color.Blue,
                    accessoryTitle: "美国",
                }
            }),
        });
    } else if (data.basic?.phonetic) {
        reformatData.push({
            type: "Phonetic",
            hint: "音标",
            children: data.translation?.map((text, idx) => {
                return {
                    title: data.basic?.phonetic + "",
                    key: text + idx,
                    icon: Icon.Message,
                    color: Color.Blue,
                    accessoryTitle: "国语[拼音]",
                }
            }),
        });
    }

    reformatData.push({
        type: "Detail",
        hint: "详细释义",
        children: data.basic?.explains?.map((text, idx) => {
            return {
                title: text,
                key: text + idx,
                icon: Icon.TextDocument,
                color: Color.Red
            }
        }),
    })

    reformatData.push({
        type: "Web Translate",
        hint: "网络翻译",
        children: data.web?.map((webResultItem, idx) => {
            return {
                title: webResultItem.key,
                key: webResultItem.key + idx,
                subtitle: useSymbolSegmentationArrayText(webResultItem.value),
                icon: Icon.Globe,
                color: Color.Orange
            }
        }),
    })

    return reformatData
}

// API Document https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html
export function requestYoudaoAPI(queryText: string, targetLanguage: string): Promise<any> {
    const preferences: IPreferences = getPreferenceValues()
    const APP_ID = preferences.appId
    const APP_KEY = preferences.appKey

    const q = Buffer.from(queryText).toString();
    const salt = Date.now();
    const sign = generateSign(q, salt, APP_ID, APP_KEY);
    const queryParam = querystring.stringify({
            q: q,
            appKey: APP_ID,
            from: "auto",
            to: targetLanguage,
            salt,
            sign
        }
    );


    return axios.post(
        "https://openapi.youdao.com/api",
        queryParam
    )
}

export function detectIsUppercaseCopyOrLowerCaseCopy(queryText = ""): COPY_TYPE {
    const isFirstRightArrow = queryText[0] === ">"
    const isSecondRightArrow = queryText[1] === ">"

    if (isFirstRightArrow && isSecondRightArrow) return COPY_TYPE.Uppercase

    if (isFirstRightArrow) return COPY_TYPE.LowercaseCamelCase

    return COPY_TYPE.Normal
}

export function removeDetectCopyModeSymbol(queryText: string, copyMode: COPY_TYPE): string {
    if (copyMode === COPY_TYPE.LowercaseCamelCase) {
        return queryText.substring(1, queryText.length).trim()
    }
    if (copyMode === COPY_TYPE.Uppercase) {
        return queryText.substring(2, queryText.length).trim()
    }

    return queryText
}

export function useSymbolSegmentationArrayText(textArray: string[]): string {
    return textArray.join("；")
}

export function defineLanguage(l: string): string {
    let fromLanguage = ""
    let toLanguage = ""
    let language = ""
    const [from, to] = l.split("2") // en2zh


    LANGUAGE_LIST.map((item, index) => {
        if (item.languageId == from) {
            fromLanguage = item.languageTitle
        }
        if (item.languageId == to) {
            toLanguage += item.languageTitle
        }
    })
    language = fromLanguage + " to " + toLanguage
    return language
}

// API Signature
function generateSign(content: string, salt: number, app_key: string, app_secret: string) {
    const md5 = crypto.createHash("md5");
    md5.update(app_key + content + salt + app_secret);
    const cipher = md5.digest("hex");
    return cipher.slice(0, 32).toUpperCase();
}
