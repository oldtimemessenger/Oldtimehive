import { api, mutate, fileToData } from "./store.js";
import { ensureConvo as makeConvo, openChatList, openThread } from "./chat.js";
import { openLive } from "./live.js";
import { mountComms } from "./comms/index.js";

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
let tab = "updates";
let feedMode = "foryou";
let profileId = null;
let profileMode = "posts";
let storyTimer = null;
let createKind = "video";
let pending = [];
let chatId = null;
let searchQ = "";
let carouselIndex = {};
let muted = true;
let viewer = null;
let profileMore = false;

// PLACEHOLDER - will use file read approach
