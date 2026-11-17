// Kearns Donut Co. menu
// To add an item: copy a line in "items", change the name/emoji/price.
// "options" lists which option groups (defined below) the item asks about.

window.MENUS = window.MENUS || {};

window.MENUS.donuts = {
  id: "donuts",
  name: "Kearns Donut Co.",
  tagline: "Fresh donuts & hot coffee",
  emoji: "🍩",
  theme: { primary: "#e8618c", accent: "#f7a531", bg: "#fff4f7" },

  categories: [
    { id: "donuts",    name: "Donuts",    emoji: "🍩" },
    { id: "holes",     name: "Donut Holes", emoji: "🟤" },
    { id: "coffee",    name: "Coffee",    emoji: "☕" },
    { id: "drinks",    name: "Drinks",    emoji: "🥤" },
    { id: "breakfast", name: "Breakfast", emoji: "🥯" },
  ],

  items: [
    // Donuts
    { id: "glazed",      cat: "donuts", name: "Glazed",           emoji: "🍩", price: 1.49 },
    { id: "choc-frost",  cat: "donuts", name: "Chocolate Frosted", emoji: "🍫", price: 1.69 },
    { id: "sprinkle",    cat: "donuts", name: "Sprinkle",          emoji: "🌈", price: 1.69 },
    { id: "strawberry",  cat: "donuts", name: "Strawberry Frosted", emoji: "🍓", price: 1.69 },
    { id: "boston",      cat: "donuts", name: "Boston Kreme",      emoji: "🍮", price: 1.89 },
    { id: "jelly",       cat: "donuts", name: "Jelly Filled",      emoji: "🫐", price: 1.89 },
    { id: "maple",       cat: "donuts", name: "Maple Frosted",     emoji: "🍁", price: 1.69 },
    { id: "cinnamon",    cat: "donuts", name: "Cinnamon Sugar",    emoji: "🟫", price: 1.49 },
    { id: "dozen",       cat: "donuts", name: "Dozen Donuts",      emoji: "📦", price: 14.99 },

    // Donut holes
    { id: "holes-10",    cat: "holes", name: "10 Holes",   emoji: "🟤", price: 2.99, options: ["holeFlavor"] },
    { id: "holes-25",    cat: "holes", name: "25 Holes",   emoji: "🛍️", price: 6.49, options: ["holeFlavor"] },
    { id: "holes-50",    cat: "holes", name: "50 Holes",   emoji: "📦", price: 11.99, options: ["holeFlavor"] },

    // Coffee
    { id: "hot-coffee",  cat: "coffee", name: "Hot Coffee",  emoji: "☕", price: 2.29, options: ["size", "milk", "sweet", "flavor"] },
    { id: "iced-coffee", cat: "coffee", name: "Iced Coffee", emoji: "🧊", price: 2.79, options: ["size", "milk", "sweet", "flavor"] },
    { id: "latte",       cat: "coffee", name: "Latte",       emoji: "🥛", price: 3.79, options: ["size", "temp", "milk", "flavor"] },
    { id: "cold-brew",   cat: "coffee", name: "Cold Brew",   emoji: "🫗", price: 3.49, options: ["size", "milk", "sweet", "flavor"] },
    { id: "frozen",      cat: "coffee", name: "Frozen Coffee", emoji: "🥶", price: 4.29, options: ["size", "flavor"] },

    // Drinks
    { id: "hot-choc",    cat: "drinks", name: "Hot Chocolate", emoji: "🍫", price: 2.49, options: ["size", "whip"] },
    { id: "lemonade",    cat: "drinks", name: "Lemonade",      emoji: "🍋", price: 2.29, options: ["size"] },
    { id: "oj",          cat: "drinks", name: "Orange Juice",  emoji: "🍊", price: 2.49 },
    { id: "milk",        cat: "drinks", name: "Milk",          emoji: "🥛", price: 1.49, options: ["milkType"] },
    { id: "water",       cat: "drinks", name: "Water",         emoji: "💧", price: 1.29 },

    // Breakfast
    { id: "bagel",       cat: "breakfast", name: "Bagel",            emoji: "🥯", price: 1.99, options: ["bagel", "spread"] },
    { id: "egg-sand",    cat: "breakfast", name: "Egg & Cheese",     emoji: "🍳", price: 3.99, options: ["bread", "meat"] },
    { id: "wrap",        cat: "breakfast", name: "Breakfast Wrap",   emoji: "🌯", price: 2.49, options: ["meat"] },
    { id: "hash",        cat: "breakfast", name: "Hash Browns",      emoji: "🥔", price: 1.79 },
    { id: "muffin",      cat: "breakfast", name: "Muffin",           emoji: "🧁", price: 2.29, options: ["muffin"] },
    { id: "croissant",   cat: "breakfast", name: "Croissant",        emoji: "🥐", price: 2.49 },
  ],

  // Option groups.  type "one" = pick exactly one.  type "many" = pick any.
  // price is how much the choice adds to the item.
  optionGroups: {
    size: { label: "Size", type: "one", choices: [
      { name: "Small", price: 0 }, { name: "Medium", price: 0.50 }, { name: "Large", price: 1.00 } ] },
    temp: { label: "Hot or Iced?", type: "one", choices: [
      { name: "Hot", price: 0 }, { name: "Iced", price: 0.30 } ] },
    milk: { label: "Milk / Cream", type: "one", choices: [
      { name: "Black", price: 0 }, { name: "Cream", price: 0 }, { name: "Whole Milk", price: 0 },
      { name: "Skim Milk", price: 0 }, { name: "Oat Milk", price: 0.50 }, { name: "Almond Milk", price: 0.50 } ] },
    sweet: { label: "Sweetener", type: "one", choices: [
      { name: "No Sugar", price: 0 }, { name: "1 Sugar", price: 0 }, { name: "2 Sugars", price: 0 }, { name: "3 Sugars", price: 0 } ] },
    flavor: { label: "Flavor Shot", type: "many", choices: [
      { name: "Vanilla", price: 0.50 }, { name: "Caramel", price: 0.50 }, { name: "Hazelnut", price: 0.50 },
      { name: "Mocha", price: 0.50 }, { name: "Pumpkin", price: 0.50 } ] },
    whip: { label: "Toppings", type: "many", choices: [
      { name: "Whipped Cream", price: 0.50 }, { name: "Marshmallows", price: 0.50 } ] },
    holeFlavor: { label: "Flavors", type: "many", choices: [
      { name: "Glazed", price: 0 }, { name: "Chocolate", price: 0 }, { name: "Jelly", price: 0 },
      { name: "Powdered", price: 0 }, { name: "Cinnamon", price: 0 } ] },
    milkType: { label: "Kind of Milk", type: "one", choices: [
      { name: "White", price: 0 }, { name: "Chocolate", price: 0.30 } ] },
    bagel: { label: "Bagel", type: "one", choices: [
      { name: "Plain", price: 0 }, { name: "Everything", price: 0 }, { name: "Cinnamon Raisin", price: 0 },
      { name: "Sesame", price: 0 }, { name: "Blueberry", price: 0 } ] },
    spread: { label: "Spread", type: "one", choices: [
      { name: "Plain", price: 0 }, { name: "Butter", price: 0 }, { name: "Cream Cheese", price: 0.75 } ] },
    bread: { label: "Bread", type: "one", choices: [
      { name: "English Muffin", price: 0 }, { name: "Croissant", price: 0.50 }, { name: "Bagel", price: 0.50 } ] },
    meat: { label: "Add Meat", type: "one", choices: [
      { name: "No Meat", price: 0 }, { name: "Bacon", price: 1.00 }, { name: "Sausage", price: 1.00 }, { name: "Ham", price: 1.00 } ] },
    muffin: { label: "Muffin", type: "one", choices: [
      { name: "Blueberry", price: 0 }, { name: "Chocolate Chip", price: 0 }, { name: "Corn", price: 0 } ] },
  },
};
