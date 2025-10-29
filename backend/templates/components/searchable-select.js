// Searchable Select Component for Philippine Locations
// This component provides a searchable dropdown for provinces and cities

class SearchableSelect {
    constructor(inputElement, dropdownElement, options = {}) {
        this.input = inputElement;
        this.dropdown = dropdownElement;
        this.wrapper = inputElement.closest('.searchable-select-wrapper');
        this.options = options;
        this.data = [];
        this.filteredData = [];
        this.selectedValue = null;
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        // Bind events
        this.input.addEventListener('focus', () => this.open());
        this.input.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.input.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });
    }
    
    setData(data) {
        this.data = data;
        this.filteredData = data;
    }
    
    open() {
        if (this.input.disabled) return;
        
        this.isOpen = true;
        this.wrapper.classList.add('active');
        this.renderDropdown(this.filteredData);
        this.dropdown.classList.add('show');
    }
    
    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('active');
        this.dropdown.classList.remove('show');
    }
    
    handleSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredData = this.data;
        } else {
            this.filteredData = this.data.filter(item => {
                const name = (typeof item === 'string' ? item : item.name).toLowerCase();
                const region = item.region ? item.region.toLowerCase() : '';
                return name.includes(searchTerm) || region.includes(searchTerm);
            });
        }
        
        this.renderDropdown(this.filteredData);
        
        if (!this.isOpen) {
            this.open();
        }
    }
    
    renderDropdown(items) {
        this.dropdown.innerHTML = '';
        
        if (items.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'dropdown-no-results';
            noResults.textContent = 'No results found';
            this.dropdown.appendChild(noResults);
            return;
        }
        
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            
            if (typeof item === 'string') {
                itemElement.textContent = item;
                itemElement.dataset.value = item;
            } else {
                itemElement.innerHTML = `
                    ${item.name}
                    ${item.region ? `<span class="item-region">${item.region}</span>` : ''}
                `;
                itemElement.dataset.value = item.name;
            }
            
            // Highlight if selected
            if (this.selectedValue === itemElement.dataset.value) {
                itemElement.classList.add('selected');
            }
            
            itemElement.addEventListener('click', () => this.selectItem(itemElement.dataset.value));
            
            this.dropdown.appendChild(itemElement);
        });
    }
    
    selectItem(value) {
        this.selectedValue = value;
        this.input.value = value;
        this.close();
        
        // Trigger change event
        const event = new Event('change', { bubbles: true });
        this.input.dispatchEvent(event);
        
        // Call callback if provided
        if (this.options.onSelect) {
            this.options.onSelect(value);
        }
    }
    
    handleKeyboard(e) {
        if (!this.isOpen) return;
        
        const items = this.dropdown.querySelectorAll('.dropdown-item');
        const currentIndex = Array.from(items).findIndex(item => 
            item.classList.contains('selected')
        );
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < items.length - 1) {
                    items[currentIndex + 1]?.scrollIntoView({ block: 'nearest' });
                    items[currentIndex + 1]?.click();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    items[currentIndex - 1]?.scrollIntoView({ block: 'nearest' });
                    items[currentIndex - 1]?.click();
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (items[currentIndex]) {
                    items[currentIndex].click();
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }
    
    reset() {
        this.selectedValue = null;
        this.input.value = '';
        this.filteredData = this.data;
    }
    
    enable() {
        this.input.disabled = false;
        this.input.placeholder = this.options.placeholder || 'Search...';
    }
    
    disable() {
        this.input.disabled = true;
        this.input.placeholder = this.options.disabledPlaceholder || 'Disabled';
        this.close();
    }
}

// Initialize Philippine Location Selects
function initializePhilippineLocationSelects() {
    // Check if locations data is loaded
    if (typeof philippineLocations === 'undefined') {
        console.warn('Philippine locations data not loaded yet');
        return;
    }
    
    const provinceInput = document.getElementById('salonState');
    const provinceDropdown = document.getElementById('provinceDropdown');
    const cityInput = document.getElementById('salonCity');
    const cityDropdown = document.getElementById('cityDropdown');
    
    if (!provinceInput || !provinceDropdown || !cityInput || !cityDropdown) {
        // Elements not found - this is normal if modal isn't open yet
        // Will be initialized when modal is shown
        return;
    }
    
    // Initialize Province Select
    const provinceSelect = new SearchableSelect(provinceInput, provinceDropdown, {
        placeholder: 'Search province...',
        onSelect: (province) => {
            // Enable city select and load cities for selected province
            citySelect.enable();
            citySelect.reset();
            
            const cities = philippineLocations.cities[province] || [];
            if (cities.length > 0) {
                citySelect.setData(cities);
                cityInput.placeholder = 'Search city/municipality...';
            } else {
                citySelect.disable();
                cityInput.placeholder = 'No cities available';
            }
        }
    });
    
    // Initialize City Select (disabled by default)
    const citySelect = new SearchableSelect(cityInput, cityDropdown, {
        placeholder: 'Select province first...',
        disabledPlaceholder: 'Select province first...'
    });
    
    // Load province data
    provinceSelect.setData(philippineLocations.provinces);
    
    // Store instances globally for access
    window.provinceSelect = provinceSelect;
    window.citySelect = citySelect;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePhilippineLocationSelects);
} else {
    // If modal is loaded dynamically, this will be called manually
    initializePhilippineLocationSelects();
}
