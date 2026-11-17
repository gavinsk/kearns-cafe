// Kearns Burger Barn menu
// To add an item: copy a line in "items", change the name/emoji/price.
// "options" lists which option groups (defined below) the item asks about.

window.MENUS = window.MENUS || {};

window.MENUS.burgers = {
  id: "burgers",
  name: "Kearns Burger Barn",
  tagline: "Burgers, fries & shakes",
  emoji: "🍔",
  theme: { primary: "#d62828", accent: "#fcbf49", bg: "#fff8e8" },

  categories: [
    { id: "burgers",  name: "Burgers",   emoji: "🍔" },
    { id: "chicken",  name: "Chicken",   emoji: "🍗" },
    { id: "sides",    name: "Sides",     emoji: "🍟" },
    { id: "drinks",   name: "Drinks",    emoji: "🥤" },
    { id: "desserts", name: "Desserts",  emoji: "🍦" },
    { id: "kids",     name: "Kids Meals", emoji: "🎁" },
  ],

  items: [
    // Burgers
    { id: "hamburger",   cat: "burgers", name: "Hamburger",        emoji: "🍔", price: 2.49, options: ["meal", "toppings", "extras"] },
    { id: "cheeseburger",cat: "burgers", name: "Cheeseburger",     emoji: "🧀", price: 2.99, options: ["meal", "toppings", "extras"] },
    { id: "double",      cat: "burgers", name: "Double Cheeseburger", emoji: "🍔", price: 3.99, options: ["meal", "toppings", "extras"] },
    { id: "big-barn",    cat: "burgers", name: "Big Barn Burger",  emoji: "🏠", price: 5.99, options: ["meal", "toppings", "extras"] },
    { id: "bacon-burger",cat: "burgers", name: "Bacon Burger",     emoji: "🥓", price: 5.49, options: ["meal", "toppings", "extras"] },

    // Chicken
    { id: "nuggets-6",   cat: "chicken", name: "6 Nuggets",        emoji: "🍗", price: 3.49, options: ["meal", "sauce"] },
    { id: "nuggets-10",  cat: "chicken", name: "10 Nuggets",       emoji: "🍗", price: 4.99, options: ["meal", "sauce"] },
    { id: "chick-sand",  cat: "chicken", name: "Chicken Sandwich", emoji: "🥪", price: 4.49, options: ["meal", "chickenStyle", "toppings"] },
    { id: "tenders",     cat: "chicken", name: "Chicken Tenders",  emoji: "🍖", price: 4.79, options: ["meal", "sauce"] },

    // Sides
    { id: "fries",       cat: "sides", name: "Fries",        emoji: "🍟", price: 1.99, options: ["sideSize"] },
    { id: "onion-rings", cat: "sides", name: "Onion Rings",  emoji: "🧅", price: 2.49, options: ["sideSize"] },
    { id: "apples",      cat: "sides", name: "Apple Slices", emoji: "🍎", price: 0.99 },
    { id: "salad",       cat: "sides", name: "Side Salad",   emoji: "🥗", price: 2.49 },

    // Drinks
    { id: "soda",        cat: "drinks", name: "Soda",          emoji: "🥤", price: 1.49, options: ["drinkSize", "soda"] },
    { id: "lemonade",    cat: "drinks", name: "Lemonade",      emoji: "🍋", price: 1.79, options: ["drinkSize"] },
    { id: "milk",        cat: "drinks", name: "Milk",          emoji: "🥛", price: 1.29, options: ["milkType"] },
    { id: "juice",       cat: "drinks", name: "Apple Juice",   emoji: "🧃", price: 1.29 },
    { id: "water",       cat: "drinks", name: "Water",         emoji: "💧", price: 0.99 },

    // Desserts
    { id: "shake",       cat: "desserts", name: "Milkshake",     emoji: "🥤", price: 3.49, options: ["drinkSize", "shake"] },
    { id: "cone",        cat: "desserts", name: "Ice Cream Cone", emoji: "🍦", price: 1.49, options: ["cone"] },
    { id: "sundae",      cat: "desserts", name: "Sundae",        emoji: "🍨", price: 2.49, options: ["sundae"] },
    { id: "cookie",      cat: "desserts", name: "Cookie",        emoji: "🍪", price: 0.99 },
    { id: "pie",         cat: "desserts", name: "Apple Pie",     emoji: "🥧", price: 1.49 },

    // Kids meals
    { id: "kids-burger", cat: "kids", name: "Burger Kids Meal",  emoji: "🎁", price: 4.49, options: ["kidsSide", "kidsDrink", "toy"] },
    { id: "kids-nugget", cat: "kids", name: "Nugget Kids Meal",  emoji: "🎁", price: 4.49, options: ["kidsSide", "kidsDrink", "sauce", "toy"] },
  ],

  // Option groups.  type "one" = pick exactly one.  type "many" = pick any.
  // price is how much the choice adds to the item.
  optionGroups: {
    meal: { label: "Make it a Meal?", type: "one", choices: [
      { name: "Just the Sandwich", price: 0 },
      { name: "Meal (Fries + Drink)", price: 3.00 },
      { name: "Large Meal", price: 4.00 } ] },
    toppings: { label: "Toppings (tap to remove)", type: "many", startAll: true, choices: [
      { name: "Ketchup", price: 0 }, { name: "Mustard", price: 0 }, { name: "Pickles", price: 0 },
      { name: "Onions", price: 0 }, { name: "Lettuce", price: 0 }, { name: "Tomato", price: 0 } ] },
    extras: { label: "Extras", type: "many", choices: [
      { name: "Extra Cheese", price: 0.50 }, { name: "Bacon", price: 1.00 }, { name: "Extra Patty", price: 1.50 } ] },
    sauce: { label: "Dipping Sauce", type: "many", choices: [
      { name: "BBQ", price: 0 }, { name: "Honey Mustard", price: 0 }, { name: "Ranch", price: 0 },
      { name: "Sweet & Sour", price: 0 }, { name: "Ketchup", price: 0 } ] },
    chickenStyle: { label: "Chicken", type: "one", choices: [
      { name: "Crispy", price: 0 }, { name: "Spicy", price: 0 }, { name: "Grilled", price: 0.50 } ] },
    sideSize: { label: "Size", type: "one", choices: [
      { name: "Small", price: 0 }, { name: "Medium", price: 0.60 }, { name: "Large", price: 1.00 } ] },
    drinkSize: { label: "Size", type: "one", choices: [
      { name: "Small", price: 0 }, { name: "Medium", price: 0.40 }, { name: "Large", price: 0.80 } ] },
    soda: { label: "Flavor", type: "one", choices: [
      { name: "Cola", price: 0 }, { name: "Lemon-Lime", price: 0 }, { name: "Orange", price: 0 },
      { name: "Root Beer", price: 0 }, { name: "Diet Cola", price: 0 } ] },
    milkType: { label: "Kind of Milk", type: "one", choices: [
      { name: "White", price: 0 }, { name: "Chocolate", price: 0.20 } ] },
    shake: { label: "Shake Flavor", type: "one", choices: [
      { name: "Vanilla", price: 0 }, { name: "Chocolate", price: 0 }, { name: "Strawberry", price: 0 }, { name: "Cookies & Cream", price: 0.50 } ] },
    cone: { label: "Ice Cream", type: "one", choices: [
      { name: "Vanilla", price: 0 }, { name: "Chocolate", price: 0 }, { name: "Twist", price: 0 } ] },
    sundae: { label: "Sundae Topping", type: "one", choices: [
      { name: "Hot Fudge", price: 0 }, { name: "Caramel", price: 0 }, { name: "Strawberry", price: 0 } ] },
    kidsSide: { label: "Side", type: "one", choices: [
      { name: "Small Fries", price: 0 }, { name: "Apple Slices", price: 0 } ] },
    kidsDrink: { label: "Drink", type: "one", choices: [
      { name: "Milk", price: 0 }, { name: "Chocolate Milk", price: 0 }, { name: "Apple Juice", price: 0 }, { name: "Water", price: 0 } ] },
    toy: { label: "Toy", type: "one", choices: [
      { name: "Car Toy", price: 0 }, { name: "Animal Toy", price: 0 }, { name: "Surprise Toy", price: 0 } ] },
  },
};
