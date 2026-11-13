# Internet Package BD - generator for js/data.js and js/i18n.js
# Bengali is written here in UTF-8 and emitted as \uXXXX escapes so the
# shipped sources stay pure ASCII (push argv transport corrupts raw UTF-8).
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(HERE, 'js')

OPERATORS = [
    ("gp", "Grameenphone", "গ্রামীণফোন"),
    ("robi", "Robi", "রবি"),
    ("bl", "Banglalink", "বাংলালিংক"),
    ("teletalk", "Teletalk", "টেলিটক"),
    ("other", "Other", "অন্যান্য"),
]

PACK_TYPES = [
    ("regular", "Regular", "রেগুলার"),
    ("social", "Social", "সোশ্যাল"),
    ("video", "Video", "ভিডিও"),
    ("night", "Night", "রাতের"),
    ("combo", "Combo", "কম্বো"),
]

# GB per hour of use - labelled estimates in the UI, not measured rates.
USAGE_RATES = {
    "video_low": 0.3,    # 360p-ish
    "video_std": 0.7,    # 480p-ish
    "video_hd": 1.5,     # 720p/1080p-ish
    "social": 0.15,
    "browse": 0.06,
    "music": 0.05,
}

# Fictional example packs, clearly labelled as examples in the UI.
EXAMPLE_PACKS = [
    {"operator": "gp", "name": "Example: 15 GB / 30 days", "dataGB": 15,
     "validityDays": 30, "priceBDT": 299, "type": "regular",
     "notes": "Example pack - replace with a real offer."},
    {"operator": "robi", "name": "Example: 40 GB / 30 days", "dataGB": 40,
     "validityDays": 30, "priceBDT": 499, "type": "regular",
     "notes": "Example pack - replace with a real offer."},
    {"operator": "bl", "name": "Example: 5 GB / 7 days", "dataGB": 5,
     "validityDays": 7, "priceBDT": 99, "type": "social",
     "notes": "Example pack - replace with a real offer."},
]

STRINGS = {
    "appTitle": ("Internet Package BD", "ইন্টারনেট প্যাকেজ বিডি"),
    "appSubtitle": ("Compare mobile data packs and plan your monthly data — offline, in English and Bangla.",
                    "মোবাইল ডাটা প্যাক তুলনা করুন ও মাসিক ডাটা পরিকল্পনা করুন — অফলাইনে, ইংরেজি ও বাংলায়।"),
    "tabCompare": ("Compare", "তুলনা"),
    "tabPlanner": ("Data Planner", "ডাটা পরিকল্পনা"),
    "tabMyPack": ("My Pack", "আমার প্যাক"),
    "tabPackages": ("Packages", "প্যাকেজ"),
    "noRatesNote": ("No operator prices are shipped — rates change often. Add the packs you see in your operator's app or USSD menu, and the comparison updates instantly.",
                    "কোনো অপারেটরের দাম দেওয়া নেই — দাম প্রায়ই বদলায়। আপনার অপারেটরের অ্যাপ বা USSD মেনুতে যে প্যাক দেখেন, তা যোগ করুন; তুলনা সঙ্গে সঙ্গে আপডেট হবে।"),
    "emptyPackages": ("No packages yet. Add your first pack below, or load the 3 labelled example packs.",
                      "এখনো কোনো প্যাকেজ নেই। নিচে প্রথম প্যাকটি যোগ করুন, অথবা ৩টি উদাহরণ প্যাক লোড করুন।"),
    "loadExamples": ("Load 3 example packs", "৩টি উদাহরণ প্যাক লোড করুন"),
    "filterOperator": ("Operator", "অপারেটর"),
    "filterType": ("Pack type", "প্যাকের ধরন"),
    "filterAll": ("All", "সবগুলো"),
    "onlyActive": ("Active packs only", "শুধু সক্রিয় প্যাক"),
    "cheapest": ("Cheapest", "সবচেয়ে সস্তা"),
    "perGB": ("per GB", "প্রতি জিবি"),
    "perDay": ("per day", "প্রতিদিন"),
    "dataPerDay": ("data / day", "ডাটা / দিন"),
    "validity": ("Validity", "মেয়াদ"),
    "days": ("days", "দিন"),
    "gb": ("GB", "জিবি"),
    "taka": ("৳", "৳"),
    "savesVsMostExpensive": ("cheaper than the most expensive pack", "সবচেয়ে দামি প্যাকের চেয়ে সস্তা"),
    "noMatch": ("No packs match these filters.", "এই ফিল্টারে কোনো প্যাক মেলেনি।"),
    "pause": ("Pause", "বিরতি"),
    "resume": ("Resume", "চালু করুন"),
    "edit": ("Edit", "সম্পাদনা"),
    "delete": ("Delete", "মুছুন"),
    "paused": ("Paused", "বিরতিতে"),
    "plannerTitle": ("How much data do you need each month?", "মাসে আপনার কত ডাটা দরকার?"),
    "plannerHint": ("Enter your usual daily use. Rates are estimates — video quality changes the number a lot.",
                    "আপনার দৈনন্দিন ব্যবহার লিখুন। হারগুলো আনুমানিক — ভিডিওর মান সংখ্যাটা অনেক বদলে দেয়।"),
    "videoHours": ("Video streaming (hours / day)", "ভিডিও দেখা (ঘণ্টা / দিন)"),
    "videoQuality": ("Video quality", "ভিডিওর মান"),
    "qualityLow": ("Low (360p)", "নিম্ন (৩৬০পি)"),
    "qualityStd": ("Standard (480p)", "সাধারণ (৪৮০পি)"),
    "qualityHd": ("HD (720p+)", "এইচডি (৭২০পি+)"),
    "socialHours": ("Social media (hours / day)", "সোশ্যাল মিডিয়া (ঘণ্টা / দিন)"),
    "browseHours": ("Browsing & chat (hours / day)", "ব্রাউজিং ও চ্যাট (ঘণ্টা / দিন)"),
    "musicHours": ("Music streaming (hours / day)", "গান শোনা (ঘণ্টা / দিন)"),
    "monthlyNeed": ("Estimated monthly need", "আনুমানিক মাসিক চাহিদা"),
    "monthlyNeedNote": ("Estimate only — actual use varies with video quality, app updates and background data.",
                        "শুধু আনুমানিক — ভিডিওর মান, অ্যাপ আপডেট ও ব্যাকগ্রাউন্ড ডাটায় আসল ব্যবহার বদলায়।"),
    "suggestedSize": ("Suggested pack size", "প্রস্তাবিত প্যাকের আকার"),
    "matchingPacks": ("Packs that cover your need", "আপনার চাহিদা মেটায় এমন প্যাক"),
    "noMatchingPacks": ("No saved pack covers this need yet — add packs on the Packages tab.",
                        "সংরক্ষিত কোনো প্যাক এখনো এই চাহিদা মেটায় না — Packages ট্যাবে প্যাক যোগ করুন।"),
    "coversNeed": ("covers your need", "আপনার চাহিদা মেটায়"),
    "myPackTitle": ("Track the pack you are using now", "এখন যে প্যাকটি ব্যবহার করছেন তা ট্র্যাক করুন"),
    "myPackEmpty": ("No active pack tracked. Pick a pack and a start date below.",
                    "কোনো সক্রিয় প্যাক ট্র্যাক করা হচ্ছে না। নিচে একটি প্যাক ও শুরুর তারিখ বেছে নিন।"),
    "pickPack": ("Choose a pack", "একটি প্যাক বেছে নিন"),
    "startDate": ("Start date", "শুরুর তারিখ"),
    "usedSoFar": ("Data used so far (GB)", "এ পর্যন্ত ব্যবহৃত ডাটা (জিবি)"),
    "saveMyPack": ("Start tracking", "ট্র্যাক শুরু করুন"),
    "stopTracking": ("Stop tracking", "ট্র্যাক বন্ধ করুন"),
    "updateUsed": ("Update used data", "ব্যবহৃত ডাটা আপডেট করুন"),
    "daysLeft": ("days left", "দিন বাকি"),
    "dataLeft": ("data left", "ডাটা বাকি"),
    "dailyBudget": ("daily budget left", "দৈনিক বাজেট বাকি"),
    "expired": ("Expired", "মেয়াদ শেষ"),
    "endsToday": ("Ends today", "আজ শেষ"),
    "active": ("Active", "সক্রিয়"),
    "dataFinished": ("Data finished", "ডাটা শেষ"),
    "addPackTitle": ("Add a package", "একটি প্যাকেজ যোগ করুন"),
    "editPackTitle": ("Edit package", "প্যাকেজ সম্পাদনা করুন"),
    "packName": ("Pack name", "প্যাকের নাম"),
    "packNamePh": ("e.g. 15 GB / 30 days", "যেমন: ১৫ জিবি / ৩০ দিন"),
    "dataGBLabel": ("Data (GB)", "ডাটা (জিবি)"),
    "validityLabel": ("Validity (days)", "মেয়াদ (দিন)"),
    "priceLabel": ("Price (BDT ৳)", "দাম (টাকা ৳)"),
    "notesLabel": ("Notes (optional)", "মন্তব্য (ঐচ্ছিক)"),
    "savePack": ("Save pack", "প্যাক সংরক্ষণ করুন"),
    "cancelEdit": ("Cancel", "বাতিল"),
    "exportBtn": ("Export JSON", "JSON এক্সপোর্ট"),
    "importBtn": ("Import JSON", "JSON ইমপোর্ট"),
    "eraseBtn": ("Erase all data", "সব ডাটা মুছুন"),
    "eraseConfirm": ("Type DELETE to erase everything", "সব মুছতে DELETE লিখুন"),
    "erasePlaceholder": ("Type DELETE", "DELETE লিখুন"),
    "eraseDone": ("All data erased.", "সব ডাটা মোছা হয়েছে।"),
    "importOk": ("Import complete.", "ইমপোর্ট সম্পন্ন হয়েছে।"),
    "importBad": ("Import failed: file is not a valid internet-package-bd backup.",
                 "ইমপোর্ট ব্যর্থ: ফাইলটি সঠিক internet-package-bd ব্যাকআপ নয়।"),
    "errName": ("Pack name is required.", "প্যাকের নাম আবশ্যক।"),
    "errData": ("Data must be 0.1 – 1000 GB.", "ডাটা ০.১ – ১০০০ জিবির মধ্যে হতে হবে।"),
    "errValidity": ("Validity must be 1 – 365 days.", "মেয়াদ ১ – ৩৬৫ দিনের মধ্যে হতে হবে।"),
    "errPrice": ("Price must be ৳1 – ৳100,000.", "দাম ৳১ – ৳১,০০,০০০-এর মধ্যে হতে হবে।"),
    "errUsed": ("Used data cannot exceed the pack size.", "ব্যবহৃত ডাটা প্যাকের আকারের বেশি হতে পারে না।"),
    "errHours": ("Hours must be 0 – 24 per day.", "ঘণ্টা প্রতিদিন ০ – ২৪-এর মধ্যে হতে হবে।"),
    "errStartDate": ("Start date is required.", "শুরুর তারিখ আবশ্যক।"),
    "statsTotal": ("Packages", "প্যাকেজ"),
    "statsCheapest": ("Cheapest per GB", "প্রতি জিবিতে সবচেয়ে সস্তা"),
    "statsAvg": ("Average price", "গড় দাম"),
    "statsActivePack": ("Tracked pack", "ট্র্যাক করা প্যাক"),
    "none": ("—", "—"),
    "langBtn": ("বাংলা", "English"),
    "footerNote": ("Offline app — your packs stay in this browser. Prices shown are the ones you entered; check your operator's app or USSD menu before buying.",
                   "অফলাইন অ্যাপ — আপনার প্যাকগুলো এই ব্রাউজারেই থাকে। দেখানো দাম আপনিই লিখেছেন; কেনার আগে অপারেটরের অ্যাপ বা USSD মেনু যাচাই করুন।"),
    "exampleTag": ("Example", "উদাহরণ"),
}


def emit_js(var_name, value):
    return "window.%s = %s;\n" % (var_name, json.dumps(value, ensure_ascii=True, indent=2))


def main():
    operators = [{"id": o[0], "en": o[1], "bn": o[2]} for o in OPERATORS]
    types = [{"id": t[0], "en": t[1], "bn": t[2]} for t in PACK_TYPES]
    data = {
        "OPERATORS": operators,
        "PACK_TYPES": types,
        "USAGE_RATES": USAGE_RATES,
        "EXAMPLE_PACKS": EXAMPLE_PACKS,
    }
    i18n = {"en": {}, "bn": {}}
    for k, (en, bn) in STRINGS.items():
        i18n["en"][k] = en
        i18n["bn"][k] = bn
    with open(os.path.join(JS, "data.js"), "w", encoding="ascii") as f:
        f.write("/* Generated by gen.py -- do not edit by hand. ASCII only. */\n")
        f.write(emit_js("IPBD_DATA", data))
    with open(os.path.join(JS, "i18n.js"), "w", encoding="ascii") as f:
        f.write("/* Generated by gen.py -- do not edit by hand. ASCII only. */\n")
        f.write(emit_js("IPBD_I18N", i18n))
    print("generated data.js + i18n.js (%d strings, %d operators, %d types, %d example packs)"
          % (len(STRINGS), len(operators), len(types), len(EXAMPLE_PACKS)))


if __name__ == "__main__":
    main()
