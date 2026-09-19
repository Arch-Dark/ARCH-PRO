"use strict";

/* =========================================================
   TRADING PLAN PRO
   V1
   ========================================================= */


/* =========================================================
   CONSTANTES
   ========================================================= */

const STORAGE_KEY = "trading_plan_pro_v1";

const SETUPS = [
    "ZS OA",
    "LDP + FIBO 50",
    "LDP + QM",
    "SSM1",
    "SSM2",
    "SSM3",
    "SBM1",
    "SBM2",
    "SBM3",
    "OB",
    "BB"
];


/*
 * Multiplicateurs utilisés pour convertir une variation
 * de prix en pips.
 *
 * XAUUSD :
 * 1 pip = 0.01
 * donc variation × 100
 *
 * Forex classique :
 * 1 pip = 0.0001
 * donc variation × 10 000
 *
 * JPY :
 * 1 pip = 0.01
 * donc variation × 100
 */
const PIP_MULTIPLIERS = {
    XAUUSD: 100,

    EURUSD: 10000,
    GBPUSD: 10000,
    AUDUSD: 10000,
    NZDUSD: 10000,
    USDCAD: 10000,
    USDCHF: 10000,

    USDJPY: 100
};


/*
 * Taille de contrat utilisée pour calculer le risque
 * monétaire d'une position.
 *
 * XAUUSD :
 * 1 lot = 100 unités d'or.
 *
 * Forex :
 * 1 lot = 100 000 unités.
 */
const CONTRACT_SIZES = {
    XAUUSD: 100,

    EURUSD: 100000,
    GBPUSD: 100000,
    AUDUSD: 100000,
    NZDUSD: 100000,
    USDCAD: 100000,
    USDCHF: 100000,

    USDJPY: 100000
};


/* =========================================================
   ÉTAT GLOBAL
   ========================================================= */

let state = loadState();


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeDates();

    initializeNavigation();

    initializeModals();

    initializeCapitalForm();

    initializeTradeForm();

    updateCapitalRiskPreview();

    renderEverything();

});


/* =========================================================
   STORAGE
   ========================================================= */

function createInitialState() {

    return {
        version: 1,

        activeCapitalId: null,

        capitals: [],

        trades: []
    };

}


function loadState() {

    try {

        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return createInitialState();
        }

        const parsed = JSON.parse(saved);

        if (!parsed || typeof parsed !== "object") {
            return createInitialState();
        }

        if (!Array.isArray(parsed.capitals)) {
            parsed.capitals = [];
        }

        if (!Array.isArray(parsed.trades)) {
            parsed.trades = [];
        }

        if (!Object.prototype.hasOwnProperty.call(parsed, "activeCapitalId")) {
            parsed.activeCapitalId = null;
        }

        return parsed;

    } catch (error) {

        console.error(
            "Impossible de charger les données :",
            error
        );

        return createInitialState();
    }

}


function saveState() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );

}


/* =========================================================
   UTILITAIRES
   ========================================================= */

function generateId(prefix) {

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );

}


function number(value) {

    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;

}


function absolute(value) {

    return Math.abs(number(value));

}


function round(value, decimals = 2) {

    const factor = 10 ** decimals;

    return Math.round(
        (number(value) + Number.EPSILON) * factor
    ) / factor;

}


function formatMoney(value, currency = "USD") {

    const amount = number(value);

    try {

        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(amount);

    } catch {

        return `${amount.toFixed(2)} ${currency}`;
    }

}


function formatNumber(value, decimals = 2) {

    return number(value).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );

}


function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }

    const date = new Date(
        `${dateString}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(
        "fr-FR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   CAPITAL ACTIF
   ========================================================= */

function getActiveCapital() {

    if (!state.activeCapitalId) {
        return null;
    }

    return (
        state.capitals.find(
            capital =>
                capital.id === state.activeCapitalId &&
                capital.status === "ACTIVE"
        ) || null
    );

}


function getCapitalTrades(capitalId) {

    return state.trades.filter(
        trade => trade.capitalId === capitalId
    );

}


function calculateCapitalBalance(capital) {

    const trades = getCapitalTrades(
        capital.id
    );

    const closedTrades = trades.filter(
        trade =>
            trade.result !== "OPEN"
    );

    const pnl = closedTrades.reduce(
        (total, trade) =>
            total + number(trade.pnl),
        0
    );

    return number(capital.initialCapital) + pnl;

}


function calculateCapitalProfit(capital) {

    return (
        calculateCapitalBalance(capital) -
        number(capital.initialCapital)
    );

}


function calculateCapitalRiskMoney(capital) {

    return (
        number(capital.initialCapital) *
        number(capital.riskPercent) /
        100
    );

}


/* =========================================================
   CRÉATION CAPITAL
   ========================================================= */

function initializeCapitalForm() {

    const form =
        document.getElementById("capitalForm");

    const initialCapital =
        document.getElementById("initialCapital");

    const riskPercent =
        document.getElementById("riskPercent");

    if (!form) {
        return;
    }

    initialCapital.addEventListener(
        "input",
        updateCapitalRiskPreview
    );

    riskPercent.addEventListener(
        "input",
        updateCapitalRiskPreview
    );

    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            createCapital();

        }
    );

}


function updateCapitalRiskPreview() {

    const capital =
        number(
            document.getElementById(
                "initialCapital"
            )?.value
        );

    const riskPercent =
        number(
            document.getElementById(
                "riskPercent"
            )?.value
        );

    const riskMoney =
        capital * riskPercent / 100;

    const currency =
        document.getElementById(
            "capitalCurrency"
        )?.value || "USD";

    const output =
        document.getElementById(
            "capitalRiskPreview"
        );

    if (output) {

        output.textContent =
            formatMoney(
                riskMoney,
                currency
            );

    }

}


function createCapital() {

    const name =
        document.getElementById(
            "capitalName"
        ).value.trim();

    const initialCapital =
        number(
            document.getElementById(
                "initialCapital"
            ).value
        );

    const riskPercent =
        number(
            document.getElementById(
                "riskPercent"
            ).value
        );

    const currency =
        document.getElementById(
            "capitalCurrency"
        ).value;

    const objective =
        number(
            document.getElementById(
                "capitalObjective"
            ).value
        );


    if (!name) {

        showToast(
            "Donne un nom au capital.",
            "error"
        );

        return;
    }


    if (initialCapital <= 0) {

        showToast(
            "Le capital initial doit être supérieur à 0.",
            "error"
        );

        return;
    }


    if (riskPercent <= 0 || riskPercent > 100) {

        showToast(
            "Le risque doit être compris entre 0 et 100 %.",
            "error"
        );

        return;
    }


    /*
     * Le risque est enregistré dans le capital.
     * Il ne sera donc pas redemandé dans chaque trade.
     */
    const capital = {

        id: generateId("capital"),

        name,

        initialCapital,

        currency,

        riskPercent,

        objective,

        createdAt:
            new Date().toISOString(),

        archivedAt: null,

        status: "ACTIVE"

    };


    /*
     * Si un capital est déjà actif,
     * il reste dans la liste mais on ne peut avoir
     * qu'un seul capital actif à la fois.
     *
     * L'ancien capital n'est pas automatiquement supprimé.
     * Il faudra l'archiver explicitement.
     */
    const currentActive =
        getActiveCapital();

    if (currentActive) {

        showToast(
            "Archive d'abord le capital actuellement actif.",
            "error"
        );

        return;
    }


    state.capitals.push(capital);

    state.activeCapitalId =
        capital.id;

    saveState();

    closeModal("capitalModal");

    resetCapitalForm();

    renderEverything();

    showToast(
        "Capital créé avec succès.",
        "success"
    );

}


function resetCapitalForm() {

    document
        .getElementById("capitalForm")
        ?.reset();

    updateCapitalRiskPreview();

}


/* =========================================================
   ARCHIVAGE CAPITAL
   ========================================================= */

function archiveActiveCapital() {

    const capital =
        getActiveCapital();

    if (!capital) {

        showToast(
            "Aucun capital actif à archiver.",
            "error"
        );

        return;
    }


    const trades =
        getCapitalTrades(
            capital.id
        );


    const openTrades =
        trades.filter(
            trade =>
                trade.result === "OPEN"
        );


    if (openTrades.length > 0) {

        const confirmation =
            window.confirm(
                `Ce capital possède ${openTrades.length} trade(s) encore ouvert(s).\n\nVeux-tu vraiment l'archiver ?`
            );

        if (!confirmation) {
            return;
        }

    } else {

        const confirmation =
            window.confirm(
                `Archiver le capital "${capital.name}" ?`
            );

        if (!confirmation) {
            return;
        }

    }


    capital.status = "ARCHIVED";

    capital.archivedAt =
        new Date().toISOString();

    capital.finalBalance =
        calculateCapitalBalance(
            capital
        );

    state.activeCapitalId = null;

    saveState();

    renderEverything();

    showToast(
        "Capital archivé.",
        "success"
    );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initializeNavigation() {

    const navigationButtons =
        document.querySelectorAll(
            ".nav-item[data-section]"
        );

    navigationButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const section =
                    button.dataset.section;

                navigateTo(section);

            }
        );

    });

}


function navigateTo(sectionName) {

    document
        .querySelectorAll(
            ".nav-item[data-section]"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === sectionName
            );

        });


    document
        .querySelectorAll(
            ".page-section"
        )
        .forEach(section => {

            section.classList.toggle(
                "active",
                section.id ===
                `section-${sectionName}`
            );

        });


    const titles = {

        dashboard: "Dashboard",
        plan: "Plan de Trading",
        journal: "Journal de Trade",
        performance: "Performance",
        analysis: "Analyse",
        risk: "Risk Manager",
        archives: "Capitaux archivés",
        settings: "Paramètres"

    };


    const title =
        document.getElementById(
            "pageTitle"
        );

    if (title) {

        title.textContent =
            titles[sectionName] ||
            "Trading Plan Pro";

    }

}


/* =========================================================
   MODALS
   ========================================================= */

function initializeModals() {

    document
        .querySelectorAll(
            "[data-close-modal]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.closeModal
                    );

                }
            );

        });


    document
        .querySelectorAll(
            ".modal-overlay"
        )
        .forEach(overlay => {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target === overlay
                    ) {

                        closeModal(
                            overlay.id
                        );

                    }

                }
            );

        });


    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }

            document
                .querySelectorAll(
                    ".modal-overlay:not(.hidden)"
                )
                .forEach(modal => {

                    closeModal(
                        modal.id
                    );

                });

        }
    );


    document
        .getElementById(
            "openCreateCapitalFromDashboard"
        )
        ?.addEventListener(
            "click",
            () => openModal("capitalModal")
        );


    document
        .getElementById(
            "openCreateCapitalFromArchives"
        )
        ?.addEventListener(
            "click",
            () => {

                if (getActiveCapital()) {

                    showToast(
                        "Archive d'abord le capital actif avant d'en créer un nouveau.",
                        "error"
                    );

                    return;
                }

                openModal("capitalModal");

            }
        );


    [
        "openAddTradeFromDashboard",
        "openAddTradeFromJournal",
        "openAddTradeFromEmpty"
    ]
        .forEach(id => {

            document
                .getElementById(id)
                ?.addEventListener(
                    "click",
                    () => openTradeModal()
                );

        });

}


function openModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.remove("hidden");

}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");

}


/* =========================================================
   TRADE FORM
   ========================================================= */

function initializeTradeForm() {

    const form =
        document.getElementById(
            "tradeForm"
        );

    if (!form) {
        return;
    }


    [
        "tradeAsset",
        "tradePosition",
        "tradeEntry",
        "tradeSL",
        "tradeRR",
        "tradeResult",
        "tradeExitPrice"
    ]
        .forEach(id => {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            element.addEventListener(
                "input",
                updateTradeCalculations
            );

            element.addEventListener(
                "change",
                updateTradeCalculations
            );

        });


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            saveTrade();

        }
    );

}


function openTradeModal() {

    const capital =
        getActiveCapital();


    if (!capital) {

        showToast(
            "Crée d'abord un capital actif.",
            "error"
        );

        openModal("capitalModal");

        return;
    }


    resetTradeForm();

    document
        .getElementById(
            "tradeNoCapitalWarning"
        )
        ?.classList.add("hidden");


    document
        .getElementById(
            "tradeRiskDisplay"
        ).textContent =
            formatMoney(
                calculateCapitalRiskMoney(
                    capital
                ),
                capital.currency
            );


    openModal("tradeModal");

    updateTradeCalculations();

}


function resetTradeForm() {

    const form =
        document.getElementById(
            "tradeForm"
        );

    form?.reset();


    const dateInput =
        document.getElementById(
            "tradeDate"
        );

    const timeInput =
        document.getElementById(
            "tradeTime"
        );


    const now =
        new Date();


    const date =
        now.toISOString()
            .slice(0, 10);


    const time =
        now.toTimeString()
            .slice(0, 5);


    if (dateInput) {
        dateInput.value = date;
    }

    if (timeInput) {
        timeInput.value = time;
    }


    document
        .getElementById(
            "tradeTPDisplay"
        ).textContent = "-";


    document
        .getElementById(
            "tradeLotDisplay"
        ).textContent = "0.00";


    document
        .getElementById(
            "tradeSLDistanceDisplay"
        ).textContent = "0.00";


    document
        .getElementById(
            "tradeSLPipsDisplay"
        ).textContent = "0";


    document
        .getElementById(
            "tradeResultPipsDisplay"
        ).textContent = "0";


    document
        .getElementById(
            "tradeRealizedRRDisplay"
        ).textContent = "0.00";


    document
        .getElementById(
            "tradePnLDisplay"
        ).textContent = "$0.00";


    document
        .getElementById(
            "tradeCalculationMessage"
        ).textContent =
            "Renseigne Entry et SL pour calculer automatiquement le lot et le TP.";

}


function updateTradeCalculations() {

    const capital =
        getActiveCapital();


    if (!capital) {
        return;
    }


    const asset =
        document
            .getElementById(
                "tradeAsset"
            )
            .value;


    const position =
        document
            .getElementById(
                "tradePosition"
            )
            .value;


    const entry =
        number(
            document
                .getElementById(
                    "tradeEntry"
                )
                .value
        );


    const sl =
        number(
            document
                .getElementById(
                    "tradeSL"
                )
                .value
        );


    const rr =
        number(
            document
                .getElementById(
                    "tradeRR"
                )
                .value
        );


    const riskMoney =
        calculateCapitalRiskMoney(
            capital
        );


    const slDistance =
        absolute(
            entry - sl
        );


    const pipMultiplier =
        getPipMultiplier(
            asset
        );


    const slPips =
        slDistance *
        pipMultiplier;


    const lot =
        calculateAutoLot(
            asset,
            entry,
            sl,
            riskMoney
        );


    const tp =
        calculateAutoTP(
            position,
            entry,
            sl,
            rr
        );


    document
        .getElementById(
            "tradeRiskDisplay"
        )
        .textContent =
            formatMoney(
                riskMoney,
                capital.currency
            );


    document
        .getElementById(
            "tradeSLDistanceDisplay"
        )
        .textContent =
            formatNumber(
                slDistance,
                getPriceDecimals(asset)
            );


    document
        .getElementById(
            "tradeSLPipsDisplay"
        )
        .textContent =
            formatNumber(
                slPips,
                1
            );


    document
        .getElementById(
            "tradeLotDisplay"
        )
        .textContent =
            formatNumber(
                lot,
                2
            );


    document
        .getElementById(
            "tradeTPDisplay"
        )
        .textContent =
            tp === null
                ? "-"
                : formatNumber(
                    tp,
                    getPriceDecimals(asset)
                );


    const message =
        document
            .getElementById(
                "tradeCalculationMessage"
            );


    if (!entry || !sl) {

        message.textContent =
            "Renseigne Entry et SL pour calculer automatiquement le lot et le TP.";

    } else if (
        !isValidSL(
            position,
            entry,
            sl
        )
    ) {

        message.textContent =
            position === "BUY"
                ? "Pour un BUY, le SL doit être inférieur à l'Entry."
                : "Pour un SELL, le SL doit être supérieur à l'Entry.";

    } else {

        message.textContent =
            `Risque autorisé : ${formatMoney(
                riskMoney,
                capital.currency
            )} · RR choisi : 1:${rr}`;

    }


    updateResultCalculations(
        asset,
        position,
        entry,
        sl,
        lot,
        capital
    );

}


function isValidSL(
    position,
    entry,
    sl
) {

    if (!entry || !sl) {
        return false;
    }

    if (position === "BUY") {
        return sl < entry;
    }

    return sl > entry;

}


/* =========================================================
   CALCUL PIPS
   ========================================================= */

function getPipMultiplier(asset) {

    return (
        PIP_MULTIPLIERS[asset] ||
        10000
    );

}


function getContractSize(asset) {

    return (
        CONTRACT_SIZES[asset] ||
        100000
    );

}


function getPriceDecimals(asset) {

    if (asset === "XAUUSD") {
        return 2;
    }

    if (asset === "USDJPY") {
        return 3;
    }

    return 5;

}


function calculatePips(
    asset,
    entry,
    exit,
    position
) {

    const difference =
        position === "BUY"
            ? number(exit) - number(entry)
            : number(entry) - number(exit);


    return (
        difference *
        getPipMultiplier(asset)
    );

}


/* =========================================================
   CALCUL LOT AUTOMATIQUE
   ========================================================= */

function calculateAutoLot(
    asset,
    entry,
    sl,
    riskMoney
) {

    if (
        !entry ||
        !sl ||
        !riskMoney
    ) {
        return 0;
    }


    const distance =
        absolute(
            entry - sl
        );


    if (distance <= 0) {
        return 0;
    }


    const contractSize =
        getContractSize(asset);


    /*
     * Pour les instruments dont le profit/perte
     * est directement exprimé dans la devise du compte :
     *
     * Risque = Distance × Contract Size × Lot
     *
     * Donc :
     *
     * Lot = Risque / (Distance × Contract Size)
     */
    const rawLot =
        riskMoney /
        (
            distance *
            contractSize
        );


    return normalizeLot(
        rawLot
    );

}


/*
 * Les contraintes de broker pourront être configurées
 * plus tard dans les paramètres.
 *
 * V1 :
 * minimum = 0.01
 * step = 0.01
 * maximum = 200
 */
function normalizeLot(
    rawLot
) {

    if (!Number.isFinite(rawLot) || rawLot <= 0) {
        return 0;
    }


    const minLot = 0.01;
    const maxLot = 200;
    const step = 0.01;


    let lot =
        Math.floor(
            rawLot / step
        ) * step;


    lot =
        Math.min(
            maxLot,
            lot
        );


    if (lot < minLot) {
        return 0;
    }


    return round(
        lot,
        2
    );

}


/* =========================================================
   CALCUL TP AUTOMATIQUE
   ========================================================= */

function calculateAutoTP(
    position,
    entry,
    sl,
    rr
) {

    if (
        !entry ||
        !sl ||
        !rr
    ) {
        return null;
    }


    const riskDistance =
        absolute(
            entry - sl
        );


    if (riskDistance <= 0) {
        return null;
    }


    const rewardDistance =
        riskDistance *
        rr;


    if (position === "BUY") {

        return (
            entry +
            rewardDistance
        );

    }


    return (
        entry -
        rewardDistance
    );

}


/* =========================================================
   CALCUL RÉSULTAT
   ========================================================= */

function getExitPriceFromResult(
    result,
    entry,
    sl,
    tp,
    manualExit
) {

    switch (result) {

        case "TP":
            return tp;

        case "SL":
            return sl;

        case "BE":
            /*
             * IMPORTANT :
             * BE est un prix manuel.
             * Il n'est PAS automatiquement égal à Entry.
             */
            return manualExit;

        case "MANUAL":
            return manualExit;

        default:
            return null;
    }

}


function updateResultCalculations(
    asset,
    position,
    entry,
    sl,
    lot,
    capital
) {

    const result =
        document
            .getElementById(
                "tradeResult"
            )
            .value;


    const rr =
        number(
            document
                .getElementById(
                    "tradeRR"
                )
                .value
        );


    const tp =
        calculateAutoTP(
            position,
            entry,
            sl,
            rr
        );


    const manualExit =
        number(
            document
                .getElementById(
                    "tradeExitPrice"
                )
                .value
        );


    const exitPrice =
        getExitPriceFromResult(
            result,
            entry,
            sl,
            tp,
            manualExit
        );


    const resultPips =
        exitPrice
            ? calculatePips(
                asset,
                entry,
                exitPrice,
                position
            )
            : 0;


    const slDistance =
        absolute(
            entry - sl
        );


    const realizedRR =
        exitPrice && slDistance > 0
            ? absolute(
                resultPips
            ) /
            (
                slDistance *
                getPipMultiplier(asset)
            )
            : 0;


    /*
     * P&L basé sur :
     *
     * variation de prix
     * × contract size
     * × lot
     *
     * Le signe dépend de BUY / SELL.
     */
    const pnl =
        exitPrice && lot > 0
            ? calculatePnL(
                asset,
                position,
                entry,
                exitPrice,
                lot
            )
            : 0;


    const pnlElement =
        document.getElementById(
            "tradePnLDisplay"
        );


    const rrElement =
        document.getElementById(
            "tradeRealizedRRDisplay"
        );


    const pipsElement =
        document.getElementById(
            "tradeResultPipsDisplay"
        );


    pnlElement.textContent =
        formatMoney(
            pnl,
            capital.currency
        );


    pnlElement.classList.toggle(
        "pnl-positive",
        pnl > 0
    );


    pnlElement.classList.toggle(
        "pnl-negative",
        pnl < 0
    );


    rrElement.textContent =
        formatNumber(
            realizedRR,
            2
        );


    pipsElement.textContent =
        formatNumber(
            resultPips,
            1
        );


    const exitGroup =
        document.getElementById(
            "exitPriceGroup"
        );


    /*
     * TP et SL n'ont pas besoin d'un prix de sortie manuel.
     * BE et MANUAL oui.
     */
    const needsManualExit =
        result === "BE" ||
        result === "MANUAL";


    exitGroup.classList.toggle(
        "hidden",
        !needsManualExit
    );

}


/* =========================================================
   CALCUL P&L
   ========================================================= */

function calculatePnL(
    asset,
    position,
    entry,
    exit,
    lot
) {

    const movement =
        position === "BUY"
            ? exit - entry
            : entry - exit;


    const contractSize =
        getContractSize(asset);


    return (
        movement *
        contractSize *
        lot
    );

}


/* =========================================================
   SAUVEGARDE TRADE
   ========================================================= */

function saveTrade() {

    const capital =
        getActiveCapital();


    if (!capital) {

        showToast(
            "Aucun capital actif.",
            "error"
        );

        return;
    }


    const asset =
        document
            .getElementById(
                "tradeAsset"
            )
            .value;


    const position =
        document
            .getElementById(
                "tradePosition"
            )
            .value;


    const date =
        document
            .getElementById(
                "tradeDate"
            )
            .value;


    const time =
        document
            .getElementById(
                "tradeTime"
            )
            .value;


    const entry =
        number(
            document
                .getElementById(
                    "tradeEntry"
                )
                .value
        );


    const sl =
        number(
            document
                .getElementById(
                    "tradeSL"
                )
                .value
        );


    const rr =
        number(
            document
                .getElementById(
                    "tradeRR"
                )
                .value
        );


    const result =
        document
            .getElementById(
                "tradeResult"
            )
            .value;


    const manualExit =
        number(
            document
                .getElementById(
                    "tradeExitPrice"
                )
                .value
        );


    const tp =
        calculateAutoTP(
            position,
            entry,
            sl,
            rr
        );


    if (!date) {

        showToast(
            "La date est obligatoire.",
            "error"
        );

        return;
    }


    if (!entry || !sl) {

        showToast(
            "Entry et SL sont obligatoires.",
            "error"
        );

        return;
    }


    if (
        !isValidSL(
            position,
            entry,
            sl
        )
    ) {

        showToast(
            position === "BUY"
                ? "Pour un BUY, le SL doit être inférieur à l'Entry."
                : "Pour un SELL, le SL doit être supérieur à l'Entry.",
            "error"
        );

        return;
    }


    if (!tp) {

        showToast(
            "Impossible de calculer le TP.",
            "error"
        );

        return;
    }


    const riskMoney =
        calculateCapitalRiskMoney(
            capital
        );


    const lot =
        calculateAutoLot(
            asset,
            entry,
            sl,
            riskMoney
        );


    if (lot <= 0) {

        showToast(
            "Le risque est trop faible par rapport à la distance du SL pour obtenir un lot valide.",
            "error"
        );

        return;
    }


    if (
        (
            result === "BE" ||
            result === "MANUAL"
        ) &&
        !manualExit
    ) {

        showToast(
            "Le prix de sortie manuel est obligatoire pour BE ou Manuel.",
            "error"
        );

        return;
    }


    const exitPrice =
        getExitPriceFromResult(
            result,
            entry,
            sl,
            tp,
            manualExit
        );


    const pips =
        exitPrice
            ? calculatePips(
                asset,
                entry,
                exitPrice,
                position
            )
            : 0;


    const pnl =
        exitPrice
            ? calculatePnL(
                asset,
                position,
                entry,
                exitPrice,
                lot
            )
            : 0;


    const slPips =
        absolute(
            entry - sl
        ) *
        getPipMultiplier(
            asset
        );


    const realizedRR =
        exitPrice && slPips > 0
            ? absolute(pips) / slPips
            : 0;


    const trade = {

        id: generateId("trade"),

        capitalId:
            capital.id,

        date,

        time,

        asset,

        position,

        timeframe:
            document
                .getElementById(
                    "tradeTimeframe"
                )
                .value,

        session:
            document
                .getElementById(
                    "tradeSession"
                )
                .value,

        setup:
            document
                .getElementById(
                    "tradeSetup"
                )
                .value,

        entry,

        sl,

        tp,

        lot,

        riskPercent:
            capital.riskPercent,

        riskMoney,

        rrPlanned: rr,

        result,

        exitPrice,

        pips,

        realizedRR,

        pnl,

        planRespect:
            document
                .getElementById(
                    "tradePlanRespect"
                )
                .value,

        error:
            document
                .getElementById(
                    "tradeError"
                )
                .value,

        comment:
            document
                .getElementById(
                    "tradeComment"
                )
                .value
                .trim(),

        createdAt:
            new Date().toISOString()

    };


    state.trades.push(
        trade
    );


    saveState();

    closeModal(
        "tradeModal"
    );

    renderEverything();

    showToast(
        "Trade enregistré.",
        "success"
    );

}


/* =========================================================
   RENDU GLOBAL
   ========================================================= */

function renderEverything() {

    renderCapitalBadge();

    renderDashboard();

    renderJournal();

    renderArchives();

    renderPerformance();

}


/* =========================================================
   CAPITAL BADGE
   ========================================================= */

function renderCapitalBadge() {

    const badge =
        document.getElementById(
            "activeCapitalBadge"
        );


    const capital =
        getActiveCapital();


    if (!capital) {

        badge.textContent =
            "Aucun capital actif";

        return;
    }


    const balance =
        calculateCapitalBalance(
            capital
        );


    badge.textContent =
        `${capital.name} · ${formatMoney(
            balance,
            capital.currency
        )}`;

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    const empty =
        document.getElementById(
            "dashboardEmpty"
        );


    const content =
        document.getElementById(
            "dashboardContent"
        );


    const capital =
        getActiveCapital();


    if (!capital) {

        empty.classList.remove(
            "hidden"
        );

        content.classList.add(
            "hidden"
        );

        return;
    }


    empty.classList.add(
        "hidden"
    );

    content.classList.remove(
        "hidden"
    );


    const balance =
        calculateCapitalBalance(
            capital
        );


    const profit =
        balance -
        capital.initialCapital;


    const riskMoney =
        calculateCapitalRiskMoney(
            capital
        );


    const trades =
        getCapitalTrades(
            capital.id
        );


    const closed =
        trades.filter(
            trade =>
                trade.result !== "OPEN"
        );


    const wins =
        closed.filter(
            trade =>
                trade.pnl > 0
        );


    const winrate =
        closed.length
            ? (
                wins.length /
                closed.length *
                100
            )
            : 0;


    const rrValues =
        closed
            .map(
                trade =>
                    number(
                        trade.realizedRR
                    )
            )
            .filter(
                value =>
                    value > 0
            );


    const averageRR =
        rrValues.length
            ? rrValues.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
            rrValues.length
            : 0;


    setText(
        "dashboardCapitalName",
        capital.name
    );


    setText(
        "dashboardBalance",
        formatMoney(
            balance,
            capital.currency
        )
    );


    setText(
        "dashboardProfit",
        formatMoney(
            profit,
            capital.currency
        )
    );


    setText(
        "dashboardRiskPercent",
        `${formatNumber(
            capital.riskPercent,
            2
        )}%`
    );


    setText(
        "dashboardRiskMoney",
        formatMoney(
            riskMoney,
            capital.currency
        )
    );


    setText(
        "dashboardTrades",
        trades.length
    );


    setText(
        "dashboardWinrate",
        `Winrate : ${formatNumber(
            winrate,
            1
        )}%`
    );


    setText(
        "dashboardAverageRR",
        formatNumber(
            averageRR,
            2
        )
    );


    setText(
        "dashboardInitialCapital",
        formatMoney(
            capital.initialCapital,
            capital.currency
        )
    );


    setText(
        "dashboardCurrentBalance",
        formatMoney(
            balance,
            capital.currency
        )
    );


    setText(
        "dashboardTotalProfit",
        formatMoney(
            profit,
            capital.currency
        )
    );


    setText(
        "dashboardRiskAmount",
        formatMoney(
            riskMoney,
            capital.currency
        )
    );


    setText(
        "dashboardObjective",
        capital.objective > 0
            ? formatMoney(
                capital.objective,
                capital.currency
            )
            : "-"
    );


    renderDashboardRecentTrades(
        trades
    );

}


function renderDashboardRecentTrades(
    trades
) {

    const container =
        document.getElementById(
            "dashboardRecentTrades"
        );


    const recent =
        [...trades]
            .sort(
                (a, b) =>
                    new Date(
                        b.createdAt
                    ) -
                    new Date(
                        a.createdAt
                    )
            )
            .slice(
                0,
                5
            );


    if (!recent.length) {

        container.innerHTML =
            `<div class="mini-empty">
                Aucun trade enregistré.
            </div>`;

        return;
    }


    container.innerHTML =
        recent
            .map(
                trade => {

                    const pnlClass =
                        trade.pnl > 0
                            ? "pnl-positive"
                            : trade.pnl < 0
                                ? "pnl-negative"
                                : "";


                    return `
                        <div class="detail-list">

                            <div>

                                <span>
                                    ${escapeHTML(
                                        trade.asset
                                    )}
                                    ·
                                    ${escapeHTML(
                                        trade.position
                                    )}
                                </span>

                                <strong class="${pnlClass}">
                                    ${formatMoney(
                                        trade.pnl,
                                        getActiveCapital()?.currency || "USD"
                                    )}
                                </strong>

                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


/* =========================================================
   JOURNAL
   ========================================================= */

function renderJournal() {

    const capital =
        getActiveCapital();


    const empty =
        document.getElementById(
            "journalEmpty"
        );


    const wrapper =
        document.getElementById(
            "journalTableWrapper"
        );


    const body =
        document.getElementById(
            "journalTableBody"
        );


    if (!capital) {

        empty.classList.remove(
            "hidden"
        );

        wrapper.classList.add(
            "hidden"
        );

        return;
    }


    const trades =
        getCapitalTrades(
            capital.id
        );


    if (!trades.length) {

        empty.classList.remove(
            "hidden"
        );

        wrapper.classList.add(
            "hidden"
        );

        return;
    }


    empty.classList.add(
        "hidden"
    );

    wrapper.classList.remove(
        "hidden"
    );


    const sortedTrades =
        [...trades]
            .sort(
                (a, b) =>
                    new Date(
                        `${b.date}T${b.time || "00:00"}`
                    ) -
                    new Date(
                        `${a.date}T${a.time || "00:00"}`
                    )
            );


    body.innerHTML =
        sortedTrades
            .map(
                trade => {

                    const pnlClass =
                        trade.pnl > 0
                            ? "pnl-positive"
                            : trade.pnl < 0
                                ? "pnl-negative"
                                : "";


                    const resultClass =
                        getResultClass(
                            trade.result
                        );


                    return `
                        <tr>

                            <td>
                                ${formatDate(
                                    trade.date
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        trade.asset
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(
                                    trade.position
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    trade.setup
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    trade.entry,
                                    getPriceDecimals(
                                        trade.asset
                                    )
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    trade.sl,
                                    getPriceDecimals(
                                        trade.asset
                                    )
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    trade.tp,
                                    getPriceDecimals(
                                        trade.asset
                                    )
                                )}
                            </td>

                            <td>
                                1:${formatNumber(
                                    trade.rrPlanned,
                                    2
                                )}
                            </td>

                            <td>
                                <span
                                    class="result-badge ${resultClass}"
                                >
                                    ${escapeHTML(
                                        getResultLabel(
                                            trade.result
                                        )
                                    )}
                                </span>
                            </td>

                            <td
                                class="${pnlClass}"
                            >
                                ${formatMoney(
                                    trade.pnl,
                                    capital.currency
                                )}
                            </td>

                        </tr>
                    `;

                }
            )
            .join("");

}


function getResultClass(result) {

    switch (result) {

        case "TP":
            return "result-tp";

        case "SL":
            return "result-sl";

        case "BE":
            return "result-be";

        default:
            return "result-open";

    }

}


function getResultLabel(result) {

    switch (result) {

        case "TP":
            return "TP";

        case "SL":
            return "SL";

        case "BE":
            return "BE";

        case "MANUAL":
            return "MANUEL";

        default:
            return "OUVERT";

    }

}


/* =========================================================
   ARCHIVES
   ========================================================= */

function renderArchives() {

    const container =
        document.getElementById(
            "archivesContainer"
        );


    const archived =
        state.capitals.filter(
            capital =>
                capital.status === "ARCHIVED"
        );


    const active =
        getActiveCapital();


    let html = "";


    if (active) {

        const balance =
            calculateCapitalBalance(
                active
            );


        const profit =
            calculateCapitalProfit(
                active
            );


        html += `
            <article class="archive-card">

                <div class="archive-header">

                    <div>

                        <span class="section-label">
                            ACTIF
                        </span>

                        <h3>
                            ${escapeHTML(
                                active.name
                            )}
                        </h3>

                    </div>

                    <span class="archive-status">
                        ACTIF
                    </span>

                </div>


                <div class="archive-stats">

                    <div class="archive-stat">
                        <span>Initial</span>

                        <strong>
                            ${formatMoney(
                                active.initialCapital,
                                active.currency
                            )}
                        </strong>
                    </div>


                    <div class="archive-stat">
                        <span>Solde</span>

                        <strong>
                            ${formatMoney(
                                balance,
                                active.currency
                            )}
                        </strong>
                    </div>


                    <div class="archive-stat">
                        <span>Risque</span>

                        <strong>
                            ${formatNumber(
                                active.riskPercent,
                                2
                            )}%
                        </strong>
                    </div>


                    <div class="archive-stat">
                        <span>P&L</span>

                        <strong class="${
                            profit >= 0
                                ? "pnl-positive"
                                : "pnl-negative"
                        }">
                            ${formatMoney(
                                profit,
                                active.currency
                            )}
                        </strong>
                    </div>

                </div>


                <div class="modal-actions">

                    <button
                        class="secondary-button"
                        data-action="archive-active"
                    >
                        Archiver le capital
                    </button>

                </div>

            </article>
        `;

    }


    archived.forEach(
        capital => {

            const balance =
                capital.finalBalance ??
                calculateCapitalBalance(
                    capital
                );


            const profit =
                balance -
                capital.initialCapital;


            const trades =
                getCapitalTrades(
                    capital.id
                );


            html += `
                <article class="archive-card">

                    <div class="archive-header">

                        <div>

                            <span class="section-label">
                                ARCHIVÉ
                            </span>

                            <h3>
                                ${escapeHTML(
                                    capital.name
                                )}
                            </h3>

                        </div>

                        <span class="archive-status">
                            ARCHIVÉ
                        </span>

                    </div>


                    <div class="archive-stats">

                        <div class="archive-stat">
                            <span>Initial</span>

                            <strong>
                                ${formatMoney(
                                    capital.initialCapital,
                                    capital.currency
                                )}
                            </strong>
                        </div>


                        <div class="archive-stat">
                            <span>Final</span>

                            <strong>
                                ${formatMoney(
                                    balance,
                                    capital.currency
                                )}
                            </strong>
                        </div>


                        <div class="archive-stat">
                            <span>Risque</span>

                            <strong>
                                ${formatNumber(
                                    capital.riskPercent,
                                    2
                                )}%
                            </strong>
                        </div>


                        <div class="archive-stat">
                            <span>Trades</span>

                            <strong>
                                ${trades.length}
                            </strong>
                        </div>


                        <div class="archive-stat">
                            <span>P&L</span>

                            <strong class="${
                                profit >= 0
                                    ? "pnl-positive"
                                    : "pnl-negative"
                            }">
                                ${formatMoney(
                                    profit,
                                    capital.currency
                                )}
                            </strong>
                        </div>


                        <div class="archive-stat">
                            <span>Créé le</span>

                            <strong>
                                ${formatDate(
                                    capital.createdAt
                                        ?.slice(0, 10)
                                )}
                            </strong>
                        </div>

                    </div>

                </article>
            `;

        }
    );


    if (!html) {

        html = `
            <div class="panel">

                <div class="coming-soon">

                    <div class="coming-icon">
                        ▥
                    </div>

                    <h3>
                        Aucun capital archivé
                    </h3>

                    <p>
                        Les capitaux terminés apparaîtront ici
                        avec leur historique conservé.
                    </p>

                </div>

            </div>
        `;

    }


    container.innerHTML =
        html;


    container
        .querySelector(
            '[data-action="archive-active"]'
        )
        ?.addEventListener(
            "click",
            archiveActiveCapital
        );

}


/* =========================================================
   PERFORMANCE
   ========================================================= */

function renderPerformance() {

    const capital =
        getActiveCapital();


    if (!capital) {

        setText(
            "performanceWinrate",
            "0%"
        );

        setText(
            "performanceProfitFactor",
            "0.00"
        );

        setText(
            "performanceExpectancy",
            "$0.00"
        );

        setText(
            "performanceTrades",
            "0"
        );

        return;
    }


    const trades =
        getCapitalTrades(
            capital.id
        );


    const closed =
        trades.filter(
            trade =>
                trade.result !== "OPEN"
        );


    const wins =
        closed.filter(
            trade =>
                trade.pnl > 0
        );


    const losses =
        closed.filter(
            trade =>
                trade.pnl < 0
        );


    const grossProfit =
        wins.reduce(
            (sum, trade) =>
                sum + trade.pnl,
            0
        );


    const grossLoss =
        Math.abs(
            losses.reduce(
                (sum, trade) =>
                    sum + trade.pnl,
                0
            )
        );


    const profitFactor =
        grossLoss > 0
            ? grossProfit / grossLoss
            : grossProfit > 0
                ? Infinity
                : 0;


    const winrate =
        closed.length
            ? wins.length /
              closed.length *
              100
            : 0;


    const averageWin =
        wins.length
            ? grossProfit /
              wins.length
            : 0;


    const averageLoss =
        losses.length
            ? grossLoss /
              losses.length
            : 0;


    const lossRate =
        closed.length
            ? losses.length /
              closed.length
            : 0;


    const expectancy =
        (
            winrate / 100 *
            averageWin
        ) -
        (
            lossRate *
            averageLoss
        );


    setText(
        "performanceWinrate",
        `${formatNumber(
            winrate,
            1
        )}%`
    );


    setText(
        "performanceProfitFactor",
        Number.isFinite(
            profitFactor
        )
            ? formatNumber(
                profitFactor,
                2
            )
            : "∞"
    );


    setText(
        "performanceExpectancy",
        formatMoney(
            expectancy,
            capital.currency
        )
    );


    setText(
        "performanceTrades",
        trades.length
    );

}


/* =========================================================
   DATES
   ========================================================= */

function initializeDates() {

    const dateInput =
        document.getElementById(
            "tradeDate"
        );


    if (!dateInput) {
        return;
    }


    const now =
        new Date();


    dateInput.value =
        now.toISOString()
            .slice(0, 10);

}


/* =========================================================
   TEXTE DOM
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value;
    }

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    message,
    type = "success"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.textContent =
        message;


    container.appendChild(
        toast
    );


    window.setTimeout(
        () => {

            toast.remove();

        },
        3200
    );

}


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "service-worker.js"
                )
                .catch(
                    error => {

                        console.warn(
                            "Service Worker non disponible :",
                            error
                        );

                    }
                );

        }
    );

}
