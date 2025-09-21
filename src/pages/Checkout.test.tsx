import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Checkout } from './Checkout';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { useUpsell } from '../hooks/useUpsell'; // Import useUpsell
import { waLink } from '../utils/format';
import { WHATSAPP_NUMBER } from '../utils/constants';
import { describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';

// Mock the custom hooks and utility functions
vi.mock('../hooks/useCart');
vi.mock('../hooks/useAuth');
vi.mock('../hooks/useUpsell'); // Mock useUpsell
vi.mock('../utils/format');
vi.mock('../utils/constants', () => ({
  WHATSAPP_NUMBER: '1234567890',
  EXTRAS: [
    { id: 'deshuesado', label: 'Servicio de deshuesado', price: 1500 },
  ],
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedUseCart = useCart as unknown as Mock;
const mockedUseAuth = useAuth as unknown as Mock;
const mockedUseUpsell = useUpsell as unknown as Mock;
const mockedWaLink = waLink as unknown as Mock;

describe('Checkout', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockedUseCart.mockReset();
    mockedUseAuth.mockReset();
    mockedUseUpsell.mockReset();
    mockedWaLink.mockReset();
    mockNavigate.mockReset();

    // Default mock implementations
    mockedUseCart.mockReturnValue({
      items: [],
      addItem: vi.fn(),
      setQty: vi.fn(),
      removeItem: vi.fn(),
      totalLabel: '$0',
      clearCart: vi.fn(),
    });
    mockedUseAuth.mockReturnValue({
      user: null,
    });
    mockedUseUpsell.mockReturnValue({
      open: false,
      countdown: 8,
      item: null,
      show: vi.fn(),
      accept: vi.fn(),
      cancel: vi.fn(),
      accepted: false,
      reset: vi.fn(),
    });
    mockedWaLink.mockReturnValue('whatsapp://send?text=mock_message');

    // Mock window.open
    Object.defineProperty(window, 'open', {
      writable: true,
      value: vi.fn(),
    });
  });

  test('renders "Datos de entrega" and "Tu pedido" headings', () => {
    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );
    expect(screen.getByText('Datos de entrega')).toBeInTheDocument();
    expect(screen.getByText('Tu pedido')).toBeInTheDocument();
  });

  test('displays "Todavía no agregaste productos." when cart is empty', () => {
    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );
    expect(screen.getByText('Todavía no agregaste productos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Realizar pedido/i })).toBeDisabled();
  });

  test('dispara la promo de deshuesado al enfocar un campo', () => {
    const mockShow = vi.fn();
    mockedUseUpsell.mockReturnValue({
      open: false,
      countdown: 8,
      item: null,
      show: mockShow,
      accept: vi.fn(),
      cancel: vi.fn(),
      accepted: false,
      reset: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );

    const nameInput = screen.getByLabelText(/Nombre y apellido/i);
    fireEvent.focus(nameInput);

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ id: 'deshuesado' }));
  });

  test('displays cart items correctly', () => {
    const mockItems = [
      { key: '1', name: 'Combo 1', description: 'Description 1', price: 100, qty: 1, side: 'Fries' },
      { key: '2', label: 'Extra Cheese', price: 20, qty: 2 },
    ];
    mockedUseCart.mockReturnValue({
      items: mockItems,
      addItem: vi.fn(),
      setQty: vi.fn(),
      removeItem: vi.fn(),
      totalLabel: '$140',
      clearCart: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );

    expect(screen.getByText('Combo 1')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
    expect(screen.getByText('Guarnición: Fries')).toBeInTheDocument();
    expect(screen.getByText('$ 100')).toBeInTheDocument();
    expect(screen.getAllByText('1')[0]).toBeInTheDocument(); // Quantity for Combo 1

    expect(screen.getByText('Extra Cheese')).toBeInTheDocument();
    expect(screen.getByText('$ 20')).toBeInTheDocument();
    expect(screen.getAllByText('2')[0]).toBeInTheDocument(); // Quantity for Extra Cheese

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$140')).toBeInTheDocument();
  });

  test('calls setQty when quantity buttons are clicked', () => {
    const mockSetQty = vi.fn();
    const mockItems = [{ key: '1', name: 'Combo 1', price: 100, qty: 1 }];
    mockedUseCart.mockReturnValue({
      items: mockItems,
      addItem: vi.fn(),
      setQty: mockSetQty,
      removeItem: vi.fn(),
      totalLabel: '$100',
      clearCart: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );

    const decrementButton = screen.getByRole('button', { name: '-' });
    const incrementButton = screen.getByRole('button', { name: '+' });

    fireEvent.click(decrementButton);
    expect(mockSetQty).toHaveBeenCalledWith('1', 0);

    fireEvent.click(incrementButton);
    expect(mockSetQty).toHaveBeenCalledWith('1', 2);
  });

  test('calls removeItem when "Eliminar" button is clicked', () => {
    const mockRemoveItem = vi.fn();
    const mockItems = [{ key: '1', name: 'Combo 1', price: 100, qty: 1 }];
    mockedUseCart.mockReturnValue({
      items: mockItems,
      addItem: vi.fn(),
      setQty: vi.fn(),
      removeItem: mockRemoveItem,
      totalLabel: '$100',
      clearCart: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(mockRemoveItem).toHaveBeenCalledWith('1');
  });

  test('handles "Realizar pedido" button click', () => {
    const mockClearCart = vi.fn();
    const mockAddItem = vi.fn();
    const mockItems = [{ key: '1', name: 'Combo 1', price: 100, qty: 1 }];
    mockedUseCart.mockReturnValue({
      items: mockItems,
      addItem: mockAddItem,
      setQty: vi.fn(),
      removeItem: vi.fn(),
      totalLabel: '$100',
      clearCart: mockClearCart,
    });
    mockedUseAuth.mockReturnValue({
      user: { displayName: 'Test User' },
    });
    mockedUseUpsell.mockReturnValue({
      open: false,
      countdown: 8,
      item: null,
      show: vi.fn(),
      accept: vi.fn(),
      cancel: vi.fn(),
      accepted: false,
      reset: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nombre y apellido/i), { target: { value: 'Test Customer' } });
    fireEvent.change(screen.getByLabelText(/Dirección/i), { target: { value: 'Test Address 123' } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: '1234567890' } });

    const confirmButton = screen.getByRole('button', { name: /Realizar pedido/i });
    fireEvent.click(confirmButton);

    const expectedMessage =
      `🍗 NUEVO PEDIDO - POLLOS TELLO’S\n\n` +
      `\t\u{200B}👤 Cliente: Test Customer\n` +
      `\t\u{200B}📧 Email: test@example.com\n` +
      `\t\u{200B}📱 Teléfono: 1234567890\n` +
      `\t\u{200B}📍 Dirección: Test Address 123\n\n` +
      `\t\u{200B}🛒 CARRITO:\n` +
      `\t\u{200B}- Combo 1 x1 — $\u{00A0}100\n\n` +
      `\t\u{200B}💰 TOTAL: $100\n` +
      `\t\u{200B}🍖 Pollo deshuesado: No\n` +
      `\t\u{200B}💳 Método de pago: Efectivo (MP próximamente)\n` +
      `\t\u{200B}👤 Usuario: Test User`;

    expect(mockedWaLink).toHaveBeenCalledWith(
      WHATSAPP_NUMBER,
      expect.stringContaining(expectedMessage)
    );
    expect(window.open).toHaveBeenCalledWith('whatsapp://send?text=mock_message', '_blank');
    expect(mockClearCart).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/thanks');
  });

  test('handles "Volver a combos" button click', () => {
    render(
      <BrowserRouter>
        <Checkout />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Volver a combos/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/menu');
  });
});
